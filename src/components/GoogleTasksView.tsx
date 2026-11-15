import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Circle,
  Edit3,
  FolderPlus,
  ListTodo,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

interface GoogleTaskListItem {
  id: string;
  title: string;
  updated?: string;
}

interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  updated?: string;
}

interface GoogleTasksViewProps {
  accessToken: string | null;
  activeDomain: string;
  userEmail?: string | null;
  onConnectGoogleTasks: () => Promise<string | null>;
  onTokenExpired: () => void;
}

type PendingMutation =
  | {
      kind: 'toggle-status';
      listId: string;
      task: GoogleTaskItem;
      nextStatus: 'needsAction' | 'completed';
    }
  | {
      kind: 'update-task';
      listId: string;
      task: GoogleTaskItem;
      nextTitle: string;
      nextNotes: string;
      nextDue: string;
    }
  | {
      kind: 'delete-task';
      listId: string;
      task: GoogleTaskItem;
    }
  | {
      kind: 'clear-completed';
      listId: string;
      listTitle: string;
      completedCount: number;
    }
  | {
      kind: 'delete-list';
      list: GoogleTaskListItem;
    };

const TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1';

export const GoogleTasksView: React.FC<GoogleTasksViewProps> = ({
  accessToken,
  activeDomain,
  userEmail,
  onConnectGoogleTasks,
  onTokenExpired,
}) => {
  const [taskLists, setTaskLists] = useState<GoogleTaskListItem[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [tasks, setTasks] = useState<GoogleTaskItem[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // New Task List form
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');

  // New Task form
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');

  // Edit Task modal state
  const [editingTask, setEditingTask] = useState<GoogleTaskItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDue, setEditDue] = useState('');

  // Mandatory Confirmation Dialog for any mutating / destructive Workspace API action
  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(null);

  const authorizedFetch = useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response> => {
      if (!accessToken) {
        throw new Error('Google Tasks sign-in required.');
      }
      const res = await fetch(`${TASKS_API_BASE}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
      });
      if (res.status === 401 || res.status === 403) {
        onTokenExpired();
        throw new Error('Your Google Tasks session expired or needs permission. Please sign in again.');
      }
      return res;
    },
    [accessToken, onTokenExpired]
  );

  const fetchTaskLists = useCallback(async () => {
    if (!accessToken) return;
    setIsLoadingLists(true);
    setErrorMsg(null);
    try {
      const res = await authorizedFetch('/users/@me/lists');
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(errBody.error?.message || `Failed to load Google Task lists (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as { items?: GoogleTaskListItem[] };
      const lists = data.items || [];
      setTaskLists(lists);
      setSelectedListId((prev) => {
        if (prev && lists.some((l) => l.id === prev)) return prev;
        return lists[0]?.id || '';
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load Google Task lists.');
    } finally {
      setIsLoadingLists(false);
    }
  }, [accessToken, authorizedFetch]);

  const fetchTasksForList = useCallback(
    async (listId: string) => {
      if (!accessToken || !listId) {
        setTasks([]);
        return;
      }
      setIsLoadingTasks(true);
      setErrorMsg(null);
      try {
        const res = await authorizedFetch(
          `/lists/${encodeURIComponent(listId)}/tasks?showCompleted=true&showHidden=true&maxResults=100`
        );
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(errBody.error?.message || `Failed to load tasks (HTTP ${res.status}).`);
        }
        const data = (await res.json()) as { items?: GoogleTaskItem[] };
        setTasks(data.items || []);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to load tasks.');
      } finally {
        setIsLoadingTasks(false);
      }
    },
    [accessToken, authorizedFetch]
  );

  useEffect(() => {
    if (accessToken) {
      void fetchTaskLists();
    } else {
      setTaskLists([]);
      setSelectedListId('');
      setTasks([]);
    }
  }, [accessToken, fetchTaskLists]);

  useEffect(() => {
    if (accessToken && selectedListId) {
      void fetchTasksForList(selectedListId);
    }
  }, [accessToken, selectedListId, fetchTasksForList]);

  const handleGoogleSignIn = async () => {
    setIsAuthorizing(true);
    setErrorMsg(null);
    try {
      const token = await onConnectGoogleTasks();
      if (!token) {
        setErrorMsg('Google sign-in did not return a Google Tasks access token. Please try again and allow Tasks access.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to connect Google Tasks.');
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleCreateTaskList = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newListTitle.trim();
    if (!title) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setStatusNotice(null);
    try {
      const res = await authorizedFetch('/users/@me/lists', {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(errBody.error?.message || 'Could not create task list.');
      }
      const created = (await res.json()) as GoogleTaskListItem;
      setNewListTitle('');
      setShowNewListForm(false);
      await fetchTaskLists();
      setSelectedListId(created.id);
      setStatusNotice(`Created task list "${created.title}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create task list.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListId || !newTaskTitle.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setStatusNotice(null);
    try {
      const payload: { title: string; notes?: string; due?: string } = {
        title: newTaskTitle.trim(),
      };
      if (newTaskNotes.trim()) payload.notes = newTaskNotes.trim();
      if (newTaskDue) payload.due = new Date(`${newTaskDue}T00:00:00.000Z`).toISOString();

      const res = await authorizedFetch(`/lists/${encodeURIComponent(selectedListId)}/tasks`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(errBody.error?.message || 'Could not add task.');
      }
      setNewTaskTitle('');
      setNewTaskNotes('');
      setNewTaskDue('');
      await fetchTasksForList(selectedListId);
      setStatusNotice('Added task to Google Tasks.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmMutation = async () => {
    if (!pendingMutation) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setStatusNotice(null);
    try {
      if (pendingMutation.kind === 'toggle-status') {
        const { listId, task, nextStatus } = pendingMutation;
        const res = await authorizedFetch(
          `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(task.id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              id: task.id,
              status: nextStatus,
              completed: nextStatus === 'completed' ? new Date().toISOString() : null,
            }),
          }
        );
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(errBody.error?.message || 'Failed to update task status.');
        }
        await fetchTasksForList(listId);
        setStatusNotice(
          nextStatus === 'completed'
            ? `Marked "${task.title}" as completed.`
            : `Reopened "${task.title}".`
        );
      } else if (pendingMutation.kind === 'update-task') {
        const { listId, task, nextTitle, nextNotes, nextDue } = pendingMutation;
        const payload: Record<string, unknown> = {
          id: task.id,
          title: nextTitle.trim(),
          notes: nextNotes.trim(),
          due: nextDue ? new Date(`${nextDue}T00:00:00.000Z`).toISOString() : null,
        };
        const res = await authorizedFetch(
          `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(task.id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(errBody.error?.message || 'Failed to update task.');
        }
        setEditingTask(null);
        await fetchTasksForList(listId);
        setStatusNotice(`Updated "${nextTitle.trim()}" in Google Tasks.`);
      } else if (pendingMutation.kind === 'delete-task') {
        const { listId, task } = pendingMutation;
        const res = await authorizedFetch(
          `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(task.id)}`,
          { method: 'DELETE' }
        );
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(errBody.error?.message || 'Failed to delete task.');
        }
        await fetchTasksForList(listId);
        setStatusNotice(`Deleted "${task.title}".`);
      } else if (pendingMutation.kind === 'clear-completed') {
        const { listId, listTitle } = pendingMutation;
        const res = await authorizedFetch(`/lists/${encodeURIComponent(listId)}/clear`, {
          method: 'POST',
        });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(errBody.error?.message || 'Failed to clear completed tasks.');
        }
        await fetchTasksForList(listId);
        setStatusNotice(`Cleared completed tasks in "${listTitle}".`);
      } else if (pendingMutation.kind === 'delete-list') {
        const { list } = pendingMutation;
        const res = await authorizedFetch(`/users/@me/lists/${encodeURIComponent(list.id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(errBody.error?.message || 'Failed to delete task list.');
        }
        setSelectedListId('');
        await fetchTaskLists();
        setStatusNotice(`Deleted task list "${list.title}".`);
      }
      setPendingMutation(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Google Tasks action failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeList = taskLists.find((l) => l.id === selectedListId) || null;
  const openTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const quickChecklists = [
    {
      title: `Verify Passkey & AASA on ${activeDomain}`,
      notes: `Confirm https://${activeDomain}/.well-known/apple-app-site-association returns HTTP 200 application/json without redirects.`,
    },
    {
      title: 'Test ABM sign-in for chrisbarnes@moredesa2.appleaccount.com',
      notes: 'Use temporary password from Passwords Vault -> ABM Sign-In Credentials.',
    },
    {
      title: 'Test Face ID Keychain fallback on iPhone 12 Pro',
      notes: 'Verify LAContext .biometryCurrentSet and passcode fallback on physical device.',
    },
  ];

  const getMutationCopy = (mutation: PendingMutation): { title: string; body: string; confirmLabel: string; danger: boolean } => {
    switch (mutation.kind) {
      case 'toggle-status':
        return {
          title: mutation.nextStatus === 'completed' ? 'Mark Task as Completed?' : 'Reopen Completed Task?',
          body: `This will update "${mutation.task.title}" to ${mutation.nextStatus === 'completed' ? 'completed' : 'needs action'} in your Google Tasks account.`,
          confirmLabel: mutation.nextStatus === 'completed' ? 'Mark Completed' : 'Reopen Task',
          danger: false,
        };
      case 'update-task':
        return {
          title: 'Save Changes to Google Tasks?',
          body: `Update "${mutation.task.title}" to "${mutation.nextTitle.trim()}" in Google Tasks?`,
          confirmLabel: 'Confirm Update',
          danger: false,
        };
      case 'delete-task':
        return {
          title: 'Delete Task from Google Tasks?',
          body: `Are you sure you want to permanently delete "${mutation.task.title}"? This action cannot be undone.`,
          confirmLabel: 'Delete Task',
          danger: true,
        };
      case 'clear-completed':
        return {
          title: 'Clear Completed Tasks?',
          body: `Hide/clear ${mutation.completedCount} completed task(s) from "${mutation.listTitle}" in Google Tasks?`,
          confirmLabel: 'Clear Completed',
          danger: true,
        };
      case 'delete-list':
        return {
          title: 'Delete Google Task List?',
          body: `Are you sure you want to permanently delete "${mutation.list.title}" and all tasks inside it? This action cannot be undone.`,
          confirmLabel: 'Delete List',
          danger: true,
        };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-sky-700">
            Google Workspace · Google Tasks API
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Google Tasks &amp; iOS Launch Checklists
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 leading-relaxed">
            Sync your iOS Passkey, AASA, and Apple Business Manager onboarding steps directly with your personal Google Tasks lists.
          </p>
        </div>

        {accessToken && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void fetchTaskLists();
                if (selectedListId) void fetchTasksForList(selectedListId);
              }}
              disabled={isLoadingLists || isLoadingTasks}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingLists || isLoadingTasks ? 'animate-spin' : ''}`} />
              Refresh Tasks
            </button>
            <button
              type="button"
              onClick={() => setShowNewListForm((v) => !v)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              New List
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
          {errorMsg}
        </div>
      )}

      {statusNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          {statusNotice}
        </div>
      )}

      {!accessToken ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sky-600">
            <ListTodo className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold text-slate-900">
            Connect Your Google Tasks
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 leading-relaxed">
            Sign in with Google{userEmail ? ` (${userEmail})` : ''} to view, create, complete, and organize your Google Tasks lists right here.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={isAuthorizing}
              className="inline-flex items-center gap-3 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="h-5 w-5 shrink-0"
                aria-hidden="true"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>{isAuthorizing ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Task Lists Sidebar */}
          <div className="lg:col-span-4 space-y-5">
            {showNewListForm && (
              <form
                onSubmit={(e) => void handleCreateTaskList(e)}
                className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">Create Google Task List</span>
                  <button
                    type="button"
                    onClick={() => setShowNewListForm(false)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  placeholder="e.g., iOS Release Checklist"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newListTitle.trim()}
                  className="w-full min-h-[36px] rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  Create List
                </button>
              </form>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Your Task Lists ({taskLists.length})
              </h2>
              {isLoadingLists ? (
                <div className="py-6 text-center text-xs text-slate-500">Loading task lists...</div>
              ) : taskLists.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  No Google Task lists found. Create one above.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {taskLists.map((list) => {
                    const isSelected = list.id === selectedListId;
                    return (
                      <div
                        key={list.id}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-xs transition-colors ${
                          isSelected
                            ? 'border-sky-600 bg-sky-50 text-sky-950 font-semibold'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedListId(list.id)}
                          className="flex-1 text-left truncate"
                        >
                          {list.title}
                        </button>
                        {taskLists.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setPendingMutation({ kind: 'delete-list', list })}
                            aria-label={`Delete list ${list.title}`}
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Quick iOS Launch Templates
              </h3>
              <p className="text-[11px] text-slate-500">
                Click any item below to fill the task form on the right.
              </p>
              <div className="space-y-2">
                {quickChecklists.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => {
                      setNewTaskTitle(item.title);
                      setNewTaskNotes(item.notes);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active List & Tasks */}
          <div className="lg:col-span-8 space-y-5">
            <form
              onSubmit={(e) => void handleCreateTask(e)}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-slate-900">
                  Add Task{activeList ? ` to "${activeList.title}"` : ''}
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-12">
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Task title (e.g., Verify Passkey login on iPhone 12 Pro)"
                  className="sm:col-span-8 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
                <input
                  type="date"
                  value={newTaskDue}
                  onChange={(e) => setNewTaskDue(e.target.value)}
                  aria-label="Due date"
                  className="sm:col-span-4 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={newTaskNotes}
                  onChange={(e) => setNewTaskNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="sm:col-span-9 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedListId || !newTaskTitle.trim()}
                  className="sm:col-span-3 inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Task
                </button>
              </div>
            </form>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-5 py-3">
                <div className="text-xs font-semibold text-slate-900">
                  {activeList ? activeList.title : 'Tasks'} · {openTasks.length} open · {completedTasks.length} completed
                </div>
                {activeList && completedTasks.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPendingMutation({
                        kind: 'clear-completed',
                        listId: activeList.id,
                        listTitle: activeList.title,
                        completedCount: completedTasks.length,
                      })
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Clear Completed
                  </button>
                )}
              </div>

              {isLoadingTasks ? (
                <div className="p-8 text-center text-xs text-slate-500">Loading tasks from Google Tasks...</div>
              ) : tasks.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  This list has no tasks yet. Add one above or pick an iOS Launch Template on the left.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {tasks.map((task) => {
                    const isDone = task.status === 'completed';
                    return (
                      <li key={task.id} className="flex items-start justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/70">
                        <div className="flex items-start gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() =>
                              setPendingMutation({
                                kind: 'toggle-status',
                                listId: selectedListId,
                                task,
                                nextStatus: isDone ? 'needsAction' : 'completed',
                              })
                            }
                            aria-label={isDone ? `Reopen ${task.title}` : `Complete ${task.title}`}
                            className="mt-0.5 shrink-0 text-slate-400 hover:text-sky-600"
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Circle className="h-4 w-4" />
                            )}
                          </button>

                          <div className="min-w-0 space-y-1">
                            <div
                              className={`text-sm font-medium ${
                                isDone ? 'line-through text-slate-400' : 'text-slate-900'
                              }`}
                            >
                              {task.title}
                            </div>
                            {task.notes && (
                              <p className="text-xs text-slate-600 whitespace-pre-wrap">{task.notes}</p>
                            )}
                            {task.due && (
                              <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                <Calendar className="h-3 w-3" />
                                <span>Due {task.due.slice(0, 10)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTask(task);
                              setEditTitle(task.title);
                              setEditNotes(task.notes || '');
                              setEditDue(task.due ? task.due.slice(0, 10) : '');
                            }}
                            aria-label={`Edit ${task.title}`}
                            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingMutation({
                                kind: 'delete-task',
                                listId: selectedListId,
                                task,
                              })
                            }
                            aria-label={`Delete ${task.title}`}
                            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal (routes into confirmation dialog before mutating) */}
      {editingTask && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Edit Google Task"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editTitle.trim()) return;
              setPendingMutation({
                kind: 'update-task',
                listId: selectedListId,
                task: editingTask,
                nextTitle: editTitle,
                nextNotes: editNotes,
                nextDue: editDue,
              });
            }}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-base font-bold text-slate-900">Edit Task</h3>
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Due Date</label>
                <input
                  type="date"
                  value={editDue}
                  onChange={(e) => setEditDue(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Notes</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="min-h-[38px] rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[38px] rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
              >
                Review &amp; Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mandatory User Confirmation Dialog for Mutating / Destructive Operations */}
      {pendingMutation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Google Tasks action"
        >
          {(() => {
            const copy = getMutationCopy(pendingMutation);
            return (
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      copy.danger ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'
                    }`}
                  >
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display text-base font-bold text-slate-900">{copy.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{copy.body}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setPendingMutation(null)}
                    className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleConfirmMutation()}
                    className={`min-h-[38px] rounded-lg px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${
                      copy.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-sky-600 hover:bg-sky-700'
                    }`}
                  >
                    {isSubmitting ? 'Applying...' : copy.confirmLabel}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
