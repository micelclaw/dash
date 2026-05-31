import type { MockRoute } from '../api-spy';

const PROCESS_CORE = {
  id: 'proc-1',
  name: 'core',
  pid: 1234,
  status: 'running',
  cpu: 2.5,
  memory: 128000000,
};

const PROCESS_GATEWAY = {
  id: 'proc-2',
  name: 'gateway',
  pid: 5678,
  status: 'running',
  cpu: 1.0,
  memory: 64000000,
};

export const PROCESSES_LIST = [PROCESS_CORE, PROCESS_GATEWAY];

export const processesMocks: MockRoute[] = [
  // List processes
  {
    method: 'GET',
    path: '/hal/processes',
    response: { data: PROCESSES_LIST, meta: { total: 2 } },
  },
  // Start a process
  {
    method: 'POST',
    path: '/hal/processes/**/start',
    response: { data: { status: 'starting' } },
  },
  // Stop a process
  {
    method: 'POST',
    path: '/hal/processes/**/stop',
    response: { data: { status: 'stopping' } },
  },
  // Restart a process
  {
    method: 'POST',
    path: '/hal/processes/**/restart',
    response: { data: { status: 'restarting' } },
  },
  // Unload Ollama
  {
    method: 'POST',
    path: '/hal/processes/ollama/unload',
    response: null,
    status: 204,
  },
];
