import {decode64, jsonResponse} from '../../lib/users.js';
const codeSubjects = ['amazon.com: Sign-in attempt','amazon.com: Intento de inicio de sesión','Amazon password assistance','Netflix: Tu código de inicio de sesión','Urgente: Tu código de un solo uso de HBO Max','Your one-time passcode for Disney+','Votre code d’accès à usage unique pour Disney+',"Votre code d'accès à usage unique pour Disney+",'Tu código de acceso único para Disney+'];
const linkSubjects = ['Importante: Cómo actualizar tu Hogar con Netflix','Importante: Cómo cambiar tu hogar Netflix','Tu código de acceso temporal de Netflix','Completa tu solicitud de cambio de contraseña','Completa tu solicitud de restablecimiento de contraseña'];
function messageBody(payload, mime){
  if(payload.mimeType===mime && payload.body?.data)return decode64(payload.body.data);
  for(const part of payload.parts||[]){const body=messageBody(part,mime);if(body)return body;}
  return '';
}
export async function onRequest({request,env}) {
  if(request.method!=='POST')return jsonResponse({error:'Use POST'},405);
  try {
    const {email}=await request.json();
    if(typeof email!=='string'||! /^[^\s@<>"{}]+@[^\s@<>"{}]+\.[^\s@<>"{}]+$/.test(email.trim()))return jsonResponse({error:'Correo inválido'},400);
    for(const key of ['GMAIL_CLIENT_ID','GMAIL_CLIENT_SECRET','GMAIL_REFRESH_TOKEN'])if(!env[key])return jsonResponse({error:`Falta ${key} en Cloudflare`},503);
    const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GMAIL_CLIENT_ID,client_secret:env.GMAIL_CLIENT_SECRET,refresh_token:env.GMAIL_REFRESH_TOKEN,grant_type:'refresh_token'})});
    const token=await tokenRes.json();
    if(!tokenRes.ok||!token.access_token)throw new Error('Google no pudo renovar el acceso a Gmail. Revisa las credenciales y permisos.');
    async function gmail(path){const res=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{headers:{Authorization:`Bearer ${token.access_token}`}});if(!res.ok)throw new Error(`Gmail respondió ${res.status}`);return res.json();}
    const cutoff=Date.now()-10*60*1000;
    const q=`to:${email.trim()} after:${Math.floor(cutoff/1000)}`;
    // Bounded API calls for the free Worker runtime; Gmail search filters before download.
    const list=await gmail('messages?maxResults=25&q='+encodeURIComponent(q));
    const messages=[];
    for(const msg of list.messages||[])messages.push(await gmail('messages/'+encodeURIComponent(msg.id)+'?format=full'));
    function fields(msg){const h=msg.payload?.headers||[];const get=n=>h.find(x=>x.name.toLowerCase()===n)?.value||'';return {subject:get('subject'),to:get('to'),time:Number(msg.internalDate)||Date.parse(get('date'))};}
    function valid(f){return f.to.toLowerCase().includes(email.trim().toLowerCase()) && f.time>=cutoff && f.time<=Date.now()+60000;}
    for(const msg of messages){const f=fields(msg);if(valid(f)&&codeSubjects.some(s=>f.subject.includes(s))){const body=messageBody(msg.payload,'text/html')||messageBody(msg.payload,'text/plain')||msg.snippet||'';return jsonResponse({alert:'Código encontrado',body});}}
    for(const msg of messages){const f=fields(msg);if(!valid(f)||!linkSubjects.some(s=>f.subject.includes(s)))continue;
      const body=messageBody(msg.payload,'text/plain')||messageBody(msg.payload,'text/html')||msg.snippet||'';
      const urls=body.match(/https?:\/\/[^\s<>"']+/g)||[];
      const preferred=['https://www.netflix.com/account/travel/verify?nftoken=','https://www.netflix.com/account/update-primary-location?nftoken='];
      const link=urls.find(u=>preferred.some(p=>u.startsWith(p)))||urls.find(u=>u.startsWith('https://www.netflix.com/password?g='));
      if(link)return jsonResponse({link:link.replace(/\]$/,'').replace(/&amp;/g,'&')});
    }
    return jsonResponse({message:'No se encontró un resultado para tu cuenta, vuelve a intentar nuevamente'},404);
  }catch(error){return jsonResponse({error:error.message},500);}
}
