import {getUserGroups,updateUserGroups} from '@/services/groups.service';
export async function ensureOwnerGroupMembership(user:{id:string;role:string}){
 if(user.role!=='owner')throw new Error('Solo el propietario puede completar esta pertenencia');
 const groups=await getUserGroups(user.id);const expected=groups.filter(g=>g.is_system&&['administrators','users'].includes(g.name));
 if(expected.length!==2)throw new Error('No se han encontrado los grupos del sistema. Revisa Usuarios y grupos.');
 const missing=expected.filter(g=>!g.member);if(missing.length)await updateUserGroups(user.id,Object.fromEntries(missing.map(g=>[g.id,true])));
 return expected.map(g=>g.name);
}
