import { Component, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Captura errores de render de todo el árbol y muestra un fallback en vez de
// dejar la pantalla en blanco. Es un class component porque React sólo expone
// getDerivedStateFromError/componentDidCatch en clases.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) return <ErrorFallback />;
    return this.props.children;
  }
}

function ErrorFallback() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6">
      <div className="max-w-sm text-center">
        <AlertTriangle size={48} strokeWidth={1.5} className="mx-auto text-brand" />
        <h1 className="mt-4 font-display text-xl font-extrabold text-ink">{t("errors.crashed")}</h1>
        <p className="mt-2 text-sm text-mute">{t("errors.crashedBody")}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm transition active:scale-95"
        >
          {t("errors.reload")}
        </button>
      </div>
    </div>
  );
}
