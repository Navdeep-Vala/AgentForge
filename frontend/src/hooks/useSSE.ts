import { useEffect, useRef } from 'react';
import { getSseUrl, getSession } from '../api/client';
import { useSessionStore } from '../store/sessionStore';
import { useFeedStore } from '../store/feedStore';
import { SSEMessage } from '../types';

const AGENT_COLORS: Record<string, string> = {
  researcher: '#3B82F6',
  coder: '#10B981',
  tester: '#F59E0B',
  rnd: '#8B5CF6',
  manager: '#F97316',
  navdeep: '#ec4899',
};

function getAgentColor(agentType: string): string {
  return AGENT_COLORS[agentType] ?? '#6B7280';
}

export function useSSE(sessionId: string | null): void {
  const {
    upsertTask,
    updateTaskStatus,
    setSessionStatus,
    setFinalReport,
    setError,
    setCurrentSession,
    addComment,
    addChatMessage,
    addSubAgent,
    addClarificationRequest,
    setClarificationRequests,
    clarificationRequests,
    updateSubAgentStatus,
  } = useSessionStore();
  const { addEvent } = useFeedStore();
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let active = true;

    function connect(): void {
      if (!sessionId || !active) return;

      const url = getSseUrl(sessionId);
      const es = new EventSource(url);
      esRef.current = es;

      es.onmessage = (event: MessageEvent<string>) => {
        try {
          const msg = JSON.parse(event.data) as SSEMessage;
          handleMessage(msg);
        } catch {
          // ignore malformed events
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (active) {
          reconnectTimeout.current = setTimeout(() => {
            getSession(sessionId)
              .then(({ session }) => {
                if (session.status === 'running' || session.status === 'pending') {
                  connect();
                } else {
                  setCurrentSession(session);
                }
              })
              .catch(() => {
                connect();
              });
          }, 3000);
        }
      };
    }

    function handleMessage(msg: SSEMessage): void {
      switch (msg.type) {
        case 'task_created':
          upsertTask({
            id: msg.task.id,
            status: 'todo',
            agent_type: msg.task.agent_type,
            agent_name: msg.task.agent_name,
            title: msg.task.title,
            description: msg.task.description,
            spawned_by_agent: msg.task.spawned_by_agent,
            created_at: msg.task.created_at,
            session_id: sessionId ?? '',
            output: null,
            tokens_used: 0,
            model_used: null,
            started_at: null,
            completed_at: null,
          });
          addEvent({
            type: 'task_started',
            message: `Task created: ${msg.task.title}`,
            agentName: msg.task.agent_name,
            agentColor: getAgentColor(msg.task.agent_type),
            taskId: msg.task.id,
          });
          if (msg.task.spawned_by_agent) {
            addEvent({
              type: 'task_spawned',
              message: `Auto-created: ${msg.task.title}`,
              agentName: msg.task.agent_name,
              agentColor: getAgentColor(msg.task.agent_type),
              taskId: msg.task.id,
            });
          }
          break;

        case 'task_claimed':
          updateTaskStatus(msg.taskId, 'in_progress', { started_at: msg.started_at });
          addEvent({
            type: 'task_started',
            message: `Claimed by ${msg.agentName}`,
            agentName: msg.agentName,
            agentColor: getAgentColor(msg.agentType),
            taskId: msg.taskId,
          });
          break;

        case 'task_complete':
          updateTaskStatus(msg.task.id, 'done', {
            output: msg.task.output,
            thought: msg.task.thought,
            tokens_used: msg.task.tokens_used,
            model_used: msg.task.model_used,
            completed_at: msg.task.completed_at,
          });
          addEvent({
            type: 'task_completed',
            message: 'Task completed',
            agentColor: '#10B981',
            taskId: msg.task.id,
          });
          break;

        case 'task_failed':
          updateTaskStatus(msg.taskId, 'failed');
          addEvent({ type: 'task_failed', message: msg.error, agentColor: '#EF4444', taskId: msg.taskId });
          break;

        case 'task_comment':
          addComment(msg.comment);
          addEvent({
            type: 'task_comment',
            message: `${msg.comment.comment_type}: ${msg.comment.content}`,
            agentName: msg.comment.agent_name,
            agentColor: getAgentColor(msg.comment.agent_type),
            taskId: msg.comment.task_id,
          });
          break;

        case 'chat_message':
          addChatMessage(msg.message);
          addEvent({
            type: 'chat_message',
            message: msg.message.content,
            agentName: msg.message.agent_name,
            agentColor: getAgentColor(msg.message.agent_type),
          });
          break;

        case 'session_complete':
          setFinalReport(msg.final_report, msg.total_tokens, msg.cost_usd);
          addEvent({ type: 'session_complete', message: 'Final report ready' });
          break;

        case 'error':
          if (!msg.taskId) {
            setError(msg.message);
            setSessionStatus('cancelled');
          }
          addEvent({ type: 'error', message: msg.message });
          break;

        case 'connected':
          break;

        case 'session_status_changed':
          setSessionStatus(msg.status);
          break;

        case 'manager_working':
          addEvent({
            type: 'manager_working',
            message: msg.message,
            agentName: 'Manager',
          });
          break;

        case 'agent_thinking':
          addEvent({
            type: 'manager_working',
            message: msg.message,
            agentName: msg.agentName,
            agentColor: getAgentColor(msg.agentType),
            taskId: msg.taskId,
          });
          break;

        case 'model_retry':
          addEvent({
            type: 'status',
            message: msg.message,
            agentName: msg.agentName,
            agentColor: '#F59E0B', // Amber for retry
          });
          break;

        case 'sub_agent_spawned':
          addSubAgent(msg.subAgent);
          addEvent({
            type: 'sub_agent_started',
            message: `Sub-agent started: ${msg.subAgent.title}`,
            agentName: msg.subAgent.title,
            agentColor: getAgentColor(msg.subAgent.sub_agent_type),
          });
          break;

        case 'sub_agent_complete':
          updateSubAgentStatus(msg.subAgentId, 'completed', msg.output, msg.thought);
          addEvent({
            type: 'sub_agent_complete',
            message: `Sub-agent completed: ${msg.subAgentId}`,
            agentColor: '#10B981',
          });
          break;

        case 'sub_agent_failed':
          addEvent({
            type: 'sub_agent_failed',
            message: msg.error,
            agentColor: '#EF4444',
          });
          break;

        case 'clarification_request':
          addClarificationRequest(msg.clarification);
          addEvent({
            type: 'clarification_request',
            message: `Clarification needed: ${msg.clarification.question}`,
            agentName: msg.clarification.agent_name,
            agentColor: getAgentColor(msg.clarification.agent_type),
          });
          break;

        case 'clarification_response':
          setClarificationRequests(
            clarificationRequests.map((c) =>
              c.id === msg.clarificationId
                ? { ...c, status: 'answered', response: msg.response, responded_at: Date.now() }
                : c
            )
          );
          addEvent({
            type: 'clarification_response',
            message: `Clarified: ${msg.response}`,
            agentName: msg.answeredBy.agent_name,
            agentColor: getAgentColor(msg.answeredBy.agent_type),
          });
          break;

        case 'needs_approval':
          updateTaskStatus(msg.taskId, 'needs_approval');
          addEvent({
            type: 'approval_requested',
            message: `Approval needed for: ${msg.details?.title || msg.taskId}`,
            agentName: 'System',
            agentColor: '#F59E0B',
          });
          break;

        case 'approval_response':
          updateTaskStatus(msg.taskId, msg.approved ? 'done' : 'in_progress');
          addEvent({
            type: 'approval_result',
            message: msg.approved
              ? `Task approved by navdeep`
              : `Task changes requested: ${msg.feedback}`,
            agentName: 'navdeep',
            agentColor: msg.approved ? '#10B981' : '#EF4444',
          });
          break;

        case 'specialized_agent_spawned':
          addEvent({
            type: 'specialized_agent_spawned',
            message: `Specialized agent spawned: ${msg.agentName} (${msg.agentType})`,
            agentName: msg.agentName,
            agentColor: '#8B5CF6',
          });
          break;

        case 'file_changed':
          addEvent({
            type: 'file_changed',
            message: `${msg.changeType === 'created' ? 'File created' : 'File deleted'}: ${msg.filePath}`,
            agentName: 'System',
            agentColor: '#6366F1',
          });
          break;

        default:
          break;
      }
    }

    connect();

    return () => {
      active = false;
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [sessionId]);
}