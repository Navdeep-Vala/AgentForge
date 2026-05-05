import { useCallback } from 'react';
import { createSession, getSession, cancelSession } from '../api/client';
import { useSessionStore } from '../store/sessionStore';
import { useModelStore } from '../store/modelStore';
import { useFeedStore } from '../store/feedStore';
import { Session } from '../types';

export function useSession() {
  const { setCurrentSession, setLoading, setError, reset } = useSessionStore();
  const { agentOverrides } = useModelStore();
  const { clearEvents } = useFeedStore();

  const startSession = useCallback(async (goal: string): Promise<string | null> => {
    setLoading(true);
    setError(null);
    clearEvents();
    try {
      const activeOverrides = Object.keys(agentOverrides).length > 0 ? agentOverrides : undefined;
      const { sessionId } = await createSession(goal, activeOverrides);

      const emptySession: Session = {
        id: sessionId,
        goal,
        status: 'pending',  // Start as pending — transitions to running when tasks are created
        final_report: null,
        total_tokens_used: 0,
        estimated_cost_usd: 0,
        heartbeat_interval_minutes: 15,
        created_at: Date.now(),
        updated_at: Date.now(),
        tasks: [],
      };
      setCurrentSession(emptySession);
      return sessionId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
      return null;
    } finally {
      setLoading(false);
    }
  }, [agentOverrides]);

  const loadSession = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    clearEvents();
    try {
      const session = await getSession(id);
      setCurrentSession(session);

      // If the session is cancelled with no tasks, surface the error
      if (session.status === 'cancelled' && (!session.tasks || session.tasks.length === 0)) {
        setError('This session was cancelled — the manager could not create tasks. Use Retry to try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, []);

  const stopSession = useCallback(async (id: string): Promise<void> => {
    try {
      await cancelSession(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel session');
    }
  }, []);

  const clearSession = useCallback(() => {
    reset();
    clearEvents();
  }, []);

  return { startSession, loadSession, stopSession, clearSession };
}
