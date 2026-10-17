"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
type Workspace={id:string;name:string;slug:string;role:string};
type Project={id:string;name:string;key_prefix:string};
type Member={id:string;display_name:string;email:string;role:string;joined_at:string};
type Invitation={id:string;email:string;role:string;expires_at:string;accepted_at:string|null;created_at:string};
type ApiError=Error&{status?:number};
const workspaceId="ws_northstar";
async function api<T>(path:string,init?:RequestInit):Promise<T>{
 const response=await fetch(`/api/backend/${path}`,{...init,credentials:"same-origin",headers:{...(init?.body?{"Content-Type":"application/json"}:{}),...init?.headers}});
 if(response.status===204)return undefined as T;
 const body=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(body.error||"The request could not be completed") as ApiError;error.status=response.status;throw error;}
 return body as T;
}
export default function SettingsPage(){
 const[workspace,setWorkspace]=useState<Workspace|null>(null),[projects,setProjects]=useState<Project[]>([]),[members,setMembers]=useState<Member[]>([]),[invitations,setInvitations]=useState<Invitation[]>([]);
 const[loading,setLoading]=useState(true),[signedOut,setSignedOut]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[inviteBusy,setInviteBusy]=useState(false),[inviteLink,setInviteLink]=useState("");
 const[projectDraft,setProjectDraft]=useState<{id?:string;name:string;keyPrefix:string}>({name:"",keyPrefix:""}),[projectBusy,setProjectBusy]=useState(false);
 const load=useCallback(async()=>{setLoading(true);setError("");try{
   const [w,p]=await Promise.all([api<{workspace:Omit<Workspace,"role">;role:string}>(`api/workspaces/${workspaceId}`),api<{projects:Project[]}>(`api/workspaces/${workspaceId}/projects`)]);
   const current={...w.workspace,role:w.role};setWorkspace(current);setProjects(p.projects);setSignedOut(false);
   if(current.role==="owner"||current.role==="admin"){
    const [m,i]=await Promise.all([api<{members:Member[]}>(`api/workspaces/${workspaceId}/members`),api<{invitations:Invitation[]}>(`api/workspaces/${workspaceId}/invitations`)]);setMembers(m.members);setInvitations(i.invitations);
   }else{setMembers([]);setInvitations([]);}
  }catch(caught){const e=caught as ApiError;if(e.status===401)setSignedOut(true);else setError(e.message);}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 async function createInvitation(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;const data=new FormData(form);setInviteBusy(true);setError("");setNotice("");setInviteLink("");try{
  const result=await api<{invitation:{acceptToken:string}}>(`api/workspaces/${workspaceId}/invitations`,{method:"POST",body:JSON.stringify({email:data.get("email"),role:data.get("role")})});
  setInviteLink(`${window.location.origin}/invite?token=${encodeURIComponent(result.invitation.acceptToken)}`);setNotice("Invitation created. Copy the link now; it appears only once. No email was sent.");form.reset();await load();
 }catch(caught){setError((caught as Error).message);}finally{setInviteBusy(false);}}
 async function revokeInvitation(id:string){if(!window.confirm("Revoke this pending invitation?"))return;try{await api<void>(`api/workspaces/${workspaceId}/invitations/${id}`,{method:"DELETE"});setNotice("Invitation revoked.");await load();}catch(e){setError((e as Error).message);}}
 async function saveProject(event:FormEvent<HTMLFormElement>){event.preventDefault();setProjectBusy(true);setError("");setNotice("");const editing=Boolean(projectDraft.id);try{
  await api<{project:Project}>(`api/workspaces/${workspaceId}/projects${editing?`/${projectDraft.id}`:""}`,{method:editing?"PATCH":"POST",body:JSON.stringify({name:projectDraft.name,keyPrefix:projectDraft.keyPrefix})});setProjectDraft({name:"",keyPrefix:""});setNotice(editing?"Project updated.":"Project created.");await load();
 }catch(e){setError((e as Error).message);}finally{setProjectBusy(false);}}
 async function deleteProject(project:Project){if(!window.confirm(`Delete ${project.name}? Its tasks and history will also be removed.`))return;try{await api<void>(`api/workspaces/${workspaceId}/projects/${project.id}`,{method:"DELETE"});setNotice("Project deleted.");await load();}catch(e){setError((e as Error).message);}}
 const canManage=workspace?.role==="owner"||workspace?.role==="admin";
 return <main className="settings-shell">
  <aside className="sidebar settings-sidebar"><a className="brand" href="/" aria-label="LaunchPad home"><span className="brand-mark">L</span><span>launchpad</span></a><div className="workspace-switcher"><span className="workspace-avatar">{workspace?.name.slice(0,1)||"N"}</span><span className="workspace-copy"><strong>{workspace?.name||"Northstar Studio"}</strong><small>Workspace</small></span></div><nav className="side-nav settings-nav" aria-label="Workspace navigation"><a className="nav-item" href="/"><span className="nav-icon">Board</span>Board</a><a className="nav-item active" href="/settings"><span className="nav-icon">Settings</span>Settings</a></nav><div className="sidebar-bottom"><div className="demo-note"><span className="demo-spark">✳</span><div><strong>Workspace admin</strong><p>Access follows your workspace role.</p></div></div></div></aside>
  <section className="main-panel settings-main"><header className="topbar"><div className="breadcrumbs"><a href="/">Northstar Studio</a><b>/</b><strong>Settings</strong></div><a className="settings-board-link" href="/">Back to board ↗</a></header>
   <div className="content-wrap settings-content">{error&&<p className="demo-error" role="alert">{error}</p>}{notice&&<p className="demo-callout" role="status">{notice}</p>}
    <div className="page-heading settings-heading"><div><p className="eyebrow">WORKSPACE</p><h1>Settings<span className="heading-period">.</span></h1><p className="heading-subtitle">Manage members, invitations, and projects in {workspace?.name||"your workspace"}.</p></div></div>
    {loading&&<p className="settings-state">Loading workspace settings…</p>}
    {signedOut&&!loading&&<section className="settings-card settings-state-card"><h2>Sign in to manage this workspace</h2><p>Workspace settings require an active account. Return to the board to start the sample demo.</p><a className="primary-button" href="/">Go to board</a></section>}
    {!loading&&workspace&&!signedOut&&!canManage&&<section className="settings-card settings-state-card"><h2>Owner or admin access required</h2><p>Your current role is <strong>{workspace.role}</strong>. You can view projects below, but member and project changes require owner or admin access.</p><p className="settings-hint">The public demo account is intentionally a member and cannot change shared workspace settings.</p></section>}
    {!loading&&workspace&&!signedOut&&<>
     {canManage&&<section className="settings-card"><div className="section-heading"><div><p className="eyebrow">TEAM</p><h2>Members <span className="settings-count">{members.length}</span></h2><p>People with access to this workspace.</p></div></div><div className="settings-table-wrap"><table className="settings-table"><thead><tr><th>Member</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead><tbody>{members.map(m=><tr key={m.id}><td><strong>{m.display_name}</strong></td><td>{m.email}</td><td><span className={`role-chip role-${m.role}`}>{m.role}</span></td><td>{new Date(m.joined_at).toLocaleDateString()}</td></tr>)}</tbody></table></div></section>}
     {canManage&&<section className="settings-card"><div className="section-heading"><div><p className="eyebrow">INVITATIONS</p><h2>Invite a teammate</h2><p>Links expire after seven days. Delivery is manual until email is configured.</p></div></div><form className="settings-form invite-form" onSubmit={createInvitation}><label className="form-label">Email address<input type="email" name="email" maxLength={254} placeholder="teammate@company.com" required/></label><label className="form-label">Role<select name="role" defaultValue="member"><option value="member">Member</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select></label><button className="primary-button" disabled={inviteBusy}>{inviteBusy?"Creating…":"Create invite"}</button></form>
      {inviteLink&&<div className="invite-link-box"><div><strong>One-time invite link</strong><code>{inviteLink}</code></div><button className="secondary-button" onClick={()=>navigator.clipboard.writeText(inviteLink).then(()=>setNotice("Invite link copied."))}>Copy link</button></div>}
      <div className="invitation-list">{invitations.map(i=>{const expired=!i.accepted_at&&new Date(i.expires_at).getTime()<=Date.now();const state=i.accepted_at?"Accepted":expired?"Expired":"Pending";return <div className="invitation-row" key={i.id}><div><strong>{i.email}</strong><small>{i.role} · expires {new Date(i.expires_at).toLocaleDateString()}</small></div><span className={`invite-status ${state.toLowerCase()}`}>{state}</span>{state==="Pending"&&<button className="text-button" onClick={()=>revokeInvitation(i.id)}>Revoke</button>}</div>})}{!invitations.length&&<p className="settings-empty">No invitations yet.</p>}</div></section>}
     <section className="settings-card"><div className="section-heading"><div><p className="eyebrow">PROJECTS</p><h2>Projects</h2><p>{canManage?"Create, rename, or remove workspace projects.":"Projects available in this workspace."}</p></div></div>
      {canManage&&<form className="settings-form project-form" onSubmit={saveProject}><label className="form-label">Project name<input value={projectDraft.name} onChange={e=>setProjectDraft(d=>({...d,name:e.target.value}))} maxLength={100} placeholder="Platform reliability" required/></label><label className="form-label">Key prefix<input value={projectDraft.keyPrefix} onChange={e=>setProjectDraft(d=>({...d,keyPrefix:e.target.value.toUpperCase()}))} minLength={2} maxLength={8} pattern="[A-Za-z0-9]{2,8}" placeholder="PLAT" required/></label><button className="primary-button" disabled={projectBusy}>{projectBusy?"Saving…":projectDraft.id?"Save changes":"Add project"}</button>{projectDraft.id&&<button type="button" className="secondary-button" onClick={()=>setProjectDraft({name:"",keyPrefix:""})}>Cancel</button>}</form>}
      <div className="project-settings-list">{projects.map(p=><article className="project-settings-row" key={p.id}><span className="project-dot dot-lime"/><div><strong>{p.name}</strong><small>{p.key_prefix} · project key prefix</small></div>{canManage&&<div className="project-row-actions"><button className="text-button" onClick={()=>setProjectDraft({id:p.id,name:p.name,keyPrefix:p.key_prefix})}>Edit</button><button className="text-button danger-text" onClick={()=>deleteProject(p)}>Delete</button></div>}</article>)}{!projects.length&&<p className="settings-empty">No projects in this workspace.</p>}</div>
     </section></>}
    <p className="settings-footer">Fictional sample data. Administrative permissions are enforced by the API.</p>
   </div>
  </section>
 </main>;
}
