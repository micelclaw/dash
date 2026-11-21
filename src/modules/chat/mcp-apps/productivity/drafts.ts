import { createContext } from 'react';

export const DraftsContext = createContext<{ mark(id: string, dirty: boolean): void }>({ mark() {} });
