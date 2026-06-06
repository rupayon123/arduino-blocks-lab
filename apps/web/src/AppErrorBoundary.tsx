import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Arduino Blocks Lab crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="app-crash-shell" role="alert">
        <section className="app-crash-card">
          <span>Arduino Blocks Lab</span>
          <h1>The workspace hit a runtime error.</h1>
          <p>
            The app kept the screen alive instead of going blank. Reload the workspace and, if it happens again, the message below is the useful clue.
          </p>
          <pre>{this.state.error.message}</pre>
          <button onClick={() => window.location.reload()}>Reload workspace</button>
        </section>
      </main>
    );
  }
}
