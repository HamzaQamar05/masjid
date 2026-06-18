import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Ummah Connect screen crashed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error-screen">
        <section className="fatal-error-card" role="alert">
          <span>Ummah Connect</span>
          <h1>This screen could not load</h1>
          <p>Your account is still signed in. Reload the screen to retry, or return home instead of being left on a blank page.</p>
          <div>
            <button type="button" onClick={() => window.location.reload()}>Reload</button>
            <button type="button" className="secondary-button" onClick={() => { window.location.href = '/home'; }}>Return home</button>
          </div>
          {import.meta.env.DEV && <pre>{this.state.error.message}</pre>}
        </section>
      </main>
    );
  }
}
