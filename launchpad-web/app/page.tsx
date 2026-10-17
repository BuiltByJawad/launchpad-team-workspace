"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

type Status = "inbox" | "progress" | "review" | "done";
type Priority = "Urgent" | "High" | "Normal" | "Low";
type Note = { id: string; body: string; author: string; createdAt: string };
type Issue = { id: string; projectId: string; key: string; title: string; detail: string; status: Status; priority: Priority; assignee: string; initials: string; color: string; due: string; labels: string[]; comments?: Note[]; activity?: Note[] };
type Project = { id: string; key_prefix: string; name: string };
const workspaceId = "ws_northstar";
const columns: { id: Status; title: string; color: string }[] = [
  { id: "inbox", title: "Inbox", color: "slate" }, { id: "progress", title: "In progress", color: "blue" },
  { id: "review", title: "In review", color: "violet" }, { id: "done", title: "Done", color: "green" },
];
const priorityOptions: Priority[] = ["Urgent", "High", "Normal", "Low"];
function nextStatus(status: Status): Status { const order: Status[] = ["inbox", "progress", "review", "done"]; return order[(order.indexOf(status) + 1) % order.length]; }

export default function Home() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [workspaceName, setWorkspaceName] = useState("Northstar Studio");
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All priorities");
  const [activeNav, setActiveNav] = useState("Overview");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [sessionStatus, setSessionStatus] = useState<"checking" | "signed-out" | "loading" | "ready" | "error">("checking");
  const [sessionMessage, setSessionMessage] = useState("");
  const [todayLabel, setTodayLabel] = useState("TODAY");
  const focusReturnRef = useRef<HTMLElement | null>(null);

  const api = async (path: string, init?: RequestInit) => {
    const response = await fetch(`/api/backend/${path}`, { ...init, credentials: "same-origin", headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
    if (response.status === 401) { setSessionStatus("signed-out"); if (sessionStatus === "ready") setSessionMessage("Your demo session expired. Start the demo again to continue."); }
    return response;
  };

  const mapTask = (task: any, keyPrefix: string): Issue => ({
    id: task.id, projectId: task.project_id, key: `${keyPrefix}-${task.sequence}`, title: task.title, detail: task.description || "",
    status: task.status, priority: (task.priority[0].toUpperCase() + task.priority.slice(1)) as Priority,
    assignee: task.assignee_name || "Demo teammate", initials: task.assignee_name ? task.assignee_name.split(" ").map((part: string) => part[0]).join("").slice(0, 2) : "DT",
    color: "violet", due: task.due_date ? new Date(`${task.due_date}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" }) : "No date",
    labels: ["Sample"], comments: [], activity: [],
  });

  const loadBoard = useCallback(async () => {
    const workspaceResponse = await api(`api/workspaces/${workspaceId}`);
    if (workspaceResponse.status === 401) { setSessionStatus("signed-out"); return; }
    if (!workspaceResponse.ok) throw new Error("Workspace could not be loaded.");
    const workspaceData = await workspaceResponse.json(); setWorkspaceName(workspaceData.workspace.name);
    const projectResponse = await api(`api/workspaces/${workspaceId}/projects`);
    if (!projectResponse.ok) throw new Error("Projects could not be loaded.");
    const projects = (await projectResponse.json()).projects as Project[];
    const selectedProject = projects.find((item) => item.key_prefix === "LCH") || projects[0];
    if (!selectedProject) throw new Error("The sample project is missing.");
    setProject(selectedProject);
    const taskResponse = await api(`api/workspaces/${workspaceId}/projects/${selectedProject.id}/tasks`);
    if (!taskResponse.ok) throw new Error("Tasks could not be loaded.");
    setIssues(((await taskResponse.json()).tasks as any[]).map((task) => mapTask(task, selectedProject.key_prefix)));
    setSessionStatus("ready"); setSessionMessage("");
  }, []);

  useEffect(() => {
    setTodayLabel(new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase());
    loadBoard().catch(() => { setSessionStatus("error"); setSessionMessage("The demo service is temporarily unavailable. Try again in a moment."); });
  }, [loadBoard]);
  useEffect(() => {
    function handleSearchShortcut(event: globalThis.KeyboardEvent) {
      if (document.querySelector('[role="dialog"]')) return;
      const target = event.target as HTMLElement | null;
      const editing = target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName || "");
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !editing) { event.preventDefault(); document.getElementById("board-search")?.focus(); }
      else if (event.key === "/" && !editing) { event.preventDefault(); document.getElementById("board-search")?.focus(); }
    }
    window.addEventListener("keydown", handleSearchShortcut); return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);
  async function startDemo() {
    setSessionStatus("loading"); setSessionMessage("");
    try { const response = await api("auth/demo", { method: "POST" }); if (!response.ok) throw new Error("Demo sign-in failed. Please try again."); await loadBoard(); }
    catch (error) { setSessionStatus("error"); setSessionMessage(error instanceof Error ? error.message : "Demo sign-in failed."); }
  }
  function openCreateDialog(trigger: HTMLElement) { focusReturnRef.current = trigger; setDialogOpen(true); }
  function closeDialog() { const target = focusReturnRef.current; setDialogOpen(false); setSelectedIssue(null); requestAnimationFrame(() => target?.focus()); }
  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); closeDialog(); return; }
    if (event.key !== "Tab") return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')).filter((el) => el.offsetParent !== null);
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  async function openIssue(issue: Issue, trigger: HTMLElement) {
    focusReturnRef.current = trigger; setSelectedIssue(issue);
    try {
      const [commentsResponse, activityResponse] = await Promise.all([api(`api/workspaces/${workspaceId}/tasks/${issue.id}/comments`), api(`api/workspaces/${workspaceId}/tasks/${issue.id}/activity`)]);
      const comments = commentsResponse.ok ? (await commentsResponse.json()).comments : [];
      const events = activityResponse.ok ? (await activityResponse.json()).events : [];
      const details = { comments: comments.map((item: any) => ({ id: item.id, body: item.body, author: item.author, createdAt: item.created_at })), activity: events.map((item: any) => ({ id: item.id, body: item.event_type.replaceAll("_", " "), author: item.actor, createdAt: item.created_at })) };
      setIssues((all) => all.map((item) => item.id === issue.id ? { ...item, ...details } : item));
      setSelectedIssue((current) => current?.id === issue.id ? { ...current, ...details } : current);
    } catch { setSessionMessage("Some task details could not be refreshed."); }
  }
  const visibleIssues = useMemo(() => issues.filter((issue) => {
    const text = [issue.key, issue.title, issue.detail, issue.assignee, ...issue.labels].join(" ").toLowerCase();
    return text.includes(query.toLowerCase()) && (priorityFilter === "All priorities" || issue.priority === priorityFilter) && (activeNav !== "My tasks" || issue.assignee === "Demo teammate");
  }), [issues, query, priorityFilter, activeNav]);
  const openCount = issues.filter((issue) => issue.status !== "done").length;
  const completedCount = issues.filter((issue) => issue.status === "done").length;
  async function moveIssue(id: string) {
    const current = issues.find((issue) => issue.id === id); if (!current) return;
    const status = nextStatus(current.status);
    const response = await api(`api/workspaces/${workspaceId}/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    if (!response.ok) { setSessionMessage("That task could not be moved. Please try again."); return; }
    const entry = { id: `a-${Date.now()}`, body: `Moved from ${current.status} to ${status}`, author: "Demo teammate", createdAt: new Date().toLocaleString() };
    const updated = { ...current, status, activity: [entry, ...(current.activity || [])] };
    setIssues((all) => all.map((issue) => issue.id === id ? updated : issue)); if (selectedIssue?.id === id) setSelectedIssue(updated);
  }
  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedIssue || !commentDraft.trim()) return;
    const response = await api(`api/workspaces/${workspaceId}/tasks/${selectedIssue.id}/comments`, { method: "POST", body: JSON.stringify({ body: commentDraft.trim() }) });
    if (!response.ok) { setSessionMessage("Your comment could not be saved."); return; }
    const result = await response.json(); const entry = { id: result.comment.id, body: commentDraft.trim(), author: "Demo teammate", createdAt: new Date().toLocaleString() };
    const updated = { ...selectedIssue, comments: [entry, ...(selectedIssue.comments || [])], activity: [{ ...entry, body: "Added a comment" }, ...(selectedIssue.activity || [])] };
    setSelectedIssue(updated); setIssues((all) => all.map((issue) => issue.id === updated.id ? updated : issue)); setCommentDraft("");
  }
  async function createIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!project) return;
    const formElement = event.currentTarget, form = new FormData(formElement), title = String(form.get("title") || "").trim(); if (!title) return;
    const priority = String(form.get("priority")).toLowerCase();
    const response = await api(`api/workspaces/${workspaceId}/projects/${project.id}/tasks`, { method: "POST", body: JSON.stringify({ title, description: String(form.get("detail") || "").trim(), priority }) });
    if (!response.ok) { setSessionMessage("Your task could not be created."); return; }
    await loadBoard(); closeDialog(); formElement.reset();
  }

  return <main className="app-shell">
    <aside className="sidebar"><a className="brand" href="/" aria-label="LaunchPad home"><span className="brand-mark">L</span><span>launchpad</span></a>
      <div className="workspace-switcher"><span className="workspace-avatar">{workspaceName.slice(0, 1)}</span><span className="workspace-copy"><strong>{workspaceName}</strong><small>Free workspace</small></span><span className="chevron">v</span></div>
      <button className="sidebar-search" aria-keyshortcuts="Control+K Meta+K" onClick={() => document.getElementById("board-search")?.focus()}><span>?</span> Search <kbd>Ctrl K</kbd></button>
      <div className="nav-label">WORKSPACE</div><nav className="side-nav" aria-label="Workspace navigation">
        {[ ["Overview", "O"], ["My tasks", "T"], ["Roadmap", "R"] ].map(([label, icon]) => <button className={"nav-item" + (activeNav === label ? " active" : "")} key={label} onClick={() => setActiveNav(label)}><span className="nav-icon">{icon}</span>{label}{label === "My tasks" && <span className="nav-count">{issues.filter((issue) => issue.assignee === "Demo teammate" && issue.status !== "done").length}</span>}</button>)}
        <a className="nav-item" href="/settings"><span className="nav-icon">S</span>Settings</a>
      </nav>
      <div className="nav-label projects-label">YOUR PROJECTS</div>{project&&<button className="project-item"><span className="project-dot dot-lime"/>{project.name}</button>}
      <div className="sidebar-bottom"><div className="demo-note"><span className="demo-spark">*</span><div><strong>Demo workspace</strong><p>Fictional sample data in the shared demo workspace.</p></div></div><button className="profile-button"><span className="avatar avatar-violet">DT</span><span><strong>Demo teammate</strong><small>Sample workspace member</small></span><span className="chevron">...</span></button></div>
    </aside>
    <section className="main-panel"><header className="topbar"><div className="breadcrumbs"><span>{workspaceName}</span><b>/</b><strong>{activeNav}</strong></div><div className="top-actions"><span className="cloud-status"><i/>{sessionStatus === "ready" ? "Live sample workspace" : sessionStatus === "signed-out" ? "Demo sign-in required" : sessionStatus === "loading" || sessionStatus === "checking" ? "Connecting..." : "Demo unavailable"}</span><button className="icon-button" aria-label="Help" title="Help">?</button><button className="avatar avatar-violet top-avatar" aria-label="Demo teammate profile">DT</button></div></header>
      <div className="content-wrap">{sessionMessage&&<p role="status" className="demo-error">{sessionMessage}</p>}{sessionStatus === "signed-out"&&<p className="demo-callout">Explore a live sample board backed by the LaunchPad API. It uses fictional team data; demo edits are shared with other visitors.</p>}{sessionStatus === "checking"&&<p className="demo-callout">Checking for an active demo session...</p>}{sessionStatus === "error"&&<p className="demo-callout">The sample workspace is unavailable. Use the button above to retry.</p>}
        <div className="page-heading"><div><p className="eyebrow">{todayLabel}</p><h1>{activeNav === "My tasks" ? "Your tasks" : activeNav === "Roadmap" ? "Project roadmap" : "Team overview"}<span className="heading-period">.</span></h1><p className="heading-subtitle">A little clarity goes a long way. Here is the team at a glance.</p></div>{sessionStatus === "ready"?<button className="primary-button" onClick={(event)=>openCreateDialog(event.currentTarget)}>+ New task</button>:<button className="primary-button" onClick={startDemo} disabled={sessionStatus === "loading"||sessionStatus === "checking"}>{sessionStatus === "loading"||sessionStatus === "checking"?"Connecting...":"Try the live demo"}</button>}</div>
        <section className="metrics-grid" aria-label="Workspace summary"><article className="metric-card"><div className="metric-top"><span>Open tasks</span><span className="metric-icon icon-lime">+</span></div><strong>{openCount}</strong><small>Sample workspace</small><div className="metric-line line-lime"/></article><article className="metric-card"><div className="metric-top"><span>In progress</span><span className="metric-icon icon-blue">~</span></div><strong>{issues.filter((issue)=>issue.status === "progress").length}</strong><small>Across sample work</small><div className="metric-line line-blue"/></article><article className="metric-card"><div className="metric-top"><span>Completed</span><span className="metric-icon icon-green">OK</span></div><strong>{completedCount}</strong><small>Example task data</small><div className="metric-line line-green"/></article><article className="metric-card focus-card"><div className="focus-ring"><span>DEMO</span></div><div><span className="focus-label">SAMPLE WORKSPACE</span><strong>{issues.length} example tasks</strong><small>Demo edits are shared</small></div></article></section>
        <section className="board-section" aria-label="Tasks board"><div className="board-toolbar"><div className="view-tabs" role="tablist" aria-label="Board view"><button className="view-tab active" role="tab" aria-selected="true">Board</button><button className="view-tab" role="tab" aria-selected="false" onClick={()=>setActiveNav("Roadmap")}>Roadmap</button></div><div className="board-tools"><label className="search-box" htmlFor="board-search"><span>?</span><input id="board-search" aria-keyshortcuts="/" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search tasks..."/><kbd>/</kbd></label><select aria-label="Filter by priority" className="filter-select" value={priorityFilter} onChange={(event)=>setPriorityFilter(event.target.value)}><option>All priorities</option>{priorityOptions.map((priority)=><option key={priority}>{priority}</option>)}</select><span className="avatar-stack" aria-label="Sample workspace team"><span className="avatar avatar-violet">MC</span><span className="avatar avatar-blue">LP</span><span className="avatar avatar-amber">SR</span></span></div></div>
          <p className="board-scroll-hint">Swipe or scroll sideways to see all columns.</p><div className="board-grid">{columns.map((column)=>{const list=visibleIssues.filter((issue)=>issue.status===column.id);return <section className="board-column" key={column.id} aria-labelledby={`column-${column.id}`}><div className="column-heading"><div className="column-title"><span className={`column-dot ${column.color}`}/><h2 id={`column-${column.id}`}>{column.title}</h2><span className="column-count">{list.length}</span></div></div><div className="issue-list">{list.map((issue)=><article className="issue-card" key={issue.id}><div className="issue-meta"><span className="issue-key">{issue.key}</span><span className={`priority priority-${issue.priority.toLowerCase()}`}><i/>{issue.priority}</span></div><h3><button className="issue-open" type="button" onClick={(event)=>openIssue(issue,event.currentTarget)}>{issue.title}</button></h3><p className="issue-detail">{issue.detail}</p><div className="label-row">{issue.labels.map((label)=><span className="label-chip" key={label}>{label}</span>)}</div><div className="issue-footer"><span className={`avatar avatar-${issue.color}`} title={issue.assignee}>{issue.initials}</span><span className="due-date">{issue.due}</span><button className="move-button" title="Move task to next stage" aria-label={`Move ${issue.key} to next stage`} onClick={()=>moveIssue(issue.id)}>-&gt;</button></div></article>)}{list.length===0&&<div className="empty-column">Nothing here yet</div>}<button className="add-task-inline" onClick={(event)=>openCreateDialog(event.currentTarget)}>+ Add a task</button></div></section>})}</div><p className="board-footnote">Your workspace, without the busywork.</p></section>
      </div>
    </section>
    {selectedIssue&&<div className="dialog-backdrop" onKeyDown={handleDialogKeyDown} onMouseDown={(event)=>{if(event.target===event.currentTarget)closeDialog();}}><section className="task-dialog detail-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-title"><div className="dialog-heading"><div><p className="eyebrow">{selectedIssue.key} - {selectedIssue.status.toUpperCase()}</p><h2 id="detail-title">{selectedIssue.title}</h2></div><button autoFocus className="icon-button" onClick={closeDialog} aria-label="Close task details">X</button></div><p className="detail-copy">{selectedIssue.detail||"No description yet."}</p><div className="detail-facts"><span><small>ASSIGNEE</small><strong>{selectedIssue.assignee}</strong></span><span><small>PRIORITY</small><strong>{selectedIssue.priority}</strong></span><span><small>DUE DATE</small><strong>{selectedIssue.due}</strong></span></div><h3 className="detail-section-title">Comments</h3><div className="comment-list">{(selectedIssue.comments||[]).map((comment)=><article className="comment-item" key={comment.id}><strong>{comment.author}</strong><time>{comment.createdAt}</time><p>{comment.body}</p></article>)}{(!selectedIssue.comments||selectedIssue.comments.length===0)&&<p className="detail-muted">No comments yet. Add the first note for your team.</p>}</div><form className="comment-form" onSubmit={addComment}><label className="form-label" htmlFor="comment-body">Add a comment<textarea id="comment-body" value={commentDraft} onChange={(event)=>setCommentDraft(event.target.value)} maxLength={1000} rows={3} placeholder="Share an update..." required/></label><div className="dialog-actions"><button type="button" className="secondary-button" onClick={()=>moveIssue(selectedIssue.id)}>Move to {nextStatus(selectedIssue.status)}</button><button className="primary-button" type="submit">Add comment</button></div></form><h3 className="detail-section-title">Activity</h3><div className="activity-list">{(selectedIssue.activity||[]).map((entry)=><p key={entry.id}><span className="activity-dot"/><strong>{entry.author}</strong>{entry.body}<time>{entry.createdAt}</time></p>)}{(!selectedIssue.activity||selectedIssue.activity.length===0)&&<p className="detail-muted">Task activity will appear here.</p>}</div></section></div>}
    {dialogOpen&&<div className="dialog-backdrop" onKeyDown={handleDialogKeyDown} onMouseDown={(event)=>{if(event.target===event.currentTarget)closeDialog();}}><section className="task-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-heading"><div><p className="eyebrow">PRODUCT WORK</p><h2 id="dialog-title">Create a task</h2></div><button className="icon-button" onClick={closeDialog} aria-label="Close dialog">X</button></div><form onSubmit={createIssue}><label className="form-label">Task name<input autoFocus name="title" maxLength={160} placeholder="What needs to get done?" required/></label><label className="form-label">Description<textarea name="detail" rows={3} maxLength={5000} placeholder="Add context for the team..."/></label><label className="form-label">Priority<select name="priority" defaultValue="Normal">{priorityOptions.map((priority)=><option key={priority}>{priority}</option>)}</select></label><div className="dialog-actions"><button type="button" className="secondary-button" onClick={closeDialog}>Cancel</button><button type="submit" className="primary-button">Create task</button></div></form></section></div>}
  </main>;
}
