import { Component, Fragment, type ReactNode } from 'react';

/** Invalid/incomplete domain payloads must not leave the native surface blank or print a technical response. */
export class ProductivityErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; retry: number }> {
 state = { failed: false, retry: 0 };
 static getDerivedStateFromError() { return { failed: true }; }
 render() {
  if (this.state.failed) return <div><p role="alert">No se pudieron mostrar los datos recibidos. Vuelve a consultar la vista.</p><button onClick={() => this.setState(state => ({ failed: false, retry: state.retry + 1 }))}>Volver a consultar</button></div>;
  // Remounting repeats only read effects. Writes are confined to explicit form submissions.
  return <Fragment key={this.state.retry}>{this.props.children}</Fragment>;
 }
}
