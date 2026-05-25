"use client";

// API-key status + "Test connection" buttons. Lives in its own component so
// the rest of the Settings page stays a server component.

import { useState, useTransition } from "react";
import { Check, AlertCircle, KeyRound, Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  testAnthropicAction,
  testGithubAction,
} from "./actions";
import type { ValidationResult } from "@/lib/key-validators";
import type { KeyStatus } from "@/lib/env-keys";

type Props = {
  anthropic: KeyStatus;
  github: KeyStatus;
};

export function ApiKeysSection({ anthropic, github }: Props) {
  return (
    <div className="space-y-4">
      <ApiKeyCard
        name="Anthropic"
        envVar="ANTHROPIC_API_KEY"
        status={anthropic}
        test={testAnthropicAction}
        howTo={<AnthropicHowTo />}
      />
      <ApiKeyCard
        name="GitHub"
        envVar="GITHUB_TOKEN"
        status={github}
        test={testGithubAction}
        howTo={<GithubHowTo />}
      />
    </div>
  );
}

// ── One card per key ──────────────────────────────────────────────────────

type ApiKeyCardProps = {
  name: string;
  envVar: string;
  status: KeyStatus;
  test: () => Promise<ValidationResult>;
  howTo: React.ReactNode;
};

function ApiKeyCard({ name, envVar, status, test, howTo }: ApiKeyCardProps) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ValidationResult | null>(null);

  const handleTest = () => {
    setResult(null);
    startTransition(async () => {
      const r = await test();
      setResult(r);
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          {name} API key
        </CardTitle>
        <KeyBadge status={status} result={result} />
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground font-mono">
          .env.local → <span className="text-foreground">{envVar}=…</span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={status === "missing" || pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? "Testing..." : "Test connection"}
          </Button>

          {result?.ok === true && (
            <span className="text-sm text-wyco-teal flex items-center gap-1.5">
              <Check className="size-4" />
              {result.detail}
            </span>
          )}
          {result?.ok === false && (
            <span className="text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle className="size-4" />
              {result.error}
            </span>
          )}
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
            How to get this key
          </summary>
          <div className="pt-3 pl-1 text-sm leading-relaxed text-muted-foreground space-y-2">
            {howTo}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function KeyBadge({
  status,
  result,
}: {
  status: KeyStatus;
  result: ValidationResult | null;
}) {
  if (result?.ok === true) {
    return <Badge variant="success">Validated</Badge>;
  }
  if (result?.ok === false) {
    return <Badge variant="destructive">Failed</Badge>;
  }
  if (status === "missing") {
    return <Badge variant="warning">Not set</Badge>;
  }
  return <Badge variant="secondary">Set</Badge>;
}

// ── Walk-throughs ─────────────────────────────────────────────────────────

function AnthropicHowTo() {
  return (
    <ol className="list-decimal pl-5 space-y-1.5">
      <li>
        Go to{" "}
        <a
          href="https://console.anthropic.com/"
          target="_blank"
          rel="noreferrer"
          className="text-wyco-teal hover:underline"
        >
          console.anthropic.com
        </a>{" "}
        and sign in (or create an account).
      </li>
      <li>
        Add a payment method if you haven&apos;t already. The validation call this
        page makes costs less than a thousandth of a penny; the real draft
        generation in Stage 5 costs a few pence per week.
      </li>
      <li>
        Click <strong>Get API keys</strong> in the left sidebar, then{" "}
        <strong>Create Key</strong>. Name it something like{" "}
        <code className="font-mono text-foreground">build-in-public-studio</code>.
      </li>
      <li>
        Copy the key (starts with <code className="font-mono">sk-ant-…</code>) —
        you won&apos;t see it again after closing the dialog.
      </li>
      <li>
        Open <code className="font-mono">.env.local</code> in this project root
        (create it from <code className="font-mono">.env.local.example</code> if
        it doesn&apos;t exist) and add the line:
        <pre className="mt-1.5 bg-card border rounded p-2 font-mono text-xs text-foreground overflow-x-auto">
          ANTHROPIC_API_KEY=sk-ant-…
        </pre>
      </li>
      <li>
        Restart the dev server (<code className="font-mono">Ctrl+C</code>, then{" "}
        <code className="font-mono">npm run dev</code>) — Next.js only reads
        .env.local on startup.
      </li>
      <li>Reload this page, then click <strong>Test connection</strong>.</li>
    </ol>
  );
}

function GithubHowTo() {
  return (
    <ol className="list-decimal pl-5 space-y-1.5">
      <li>
        Go to{" "}
        <a
          href="https://github.com/settings/tokens?type=beta"
          target="_blank"
          rel="noreferrer"
          className="text-wyco-teal hover:underline"
        >
          github.com/settings/tokens?type=beta
        </a>{" "}
        — that&apos;s the <strong>fine-grained personal access tokens</strong> page
        (more secure than the classic ones).
      </li>
      <li>
        Click <strong>Generate new token</strong>.
      </li>
      <li>
        Name it <code className="font-mono">build-in-public-studio</code>.
        Pick an expiration (90 days is sensible — you&apos;ll need to regenerate
        when it expires).
      </li>
      <li>
        Under <strong>Repository access</strong>, choose{" "}
        <strong>Only select repositories</strong> and pick the ones you want
        this app to read. (You can edit this later.)
      </li>
      <li>
        Under <strong>Repository permissions</strong>, find{" "}
        <strong>Contents</strong> and set it to <strong>Read-only</strong>.
        Everything else can stay at &quot;No access&quot;.
      </li>
      <li>
        Click <strong>Generate token</strong> and copy the value (starts with{" "}
        <code className="font-mono">github_pat_…</code>).
      </li>
      <li>
        Add to <code className="font-mono">.env.local</code>:
        <pre className="mt-1.5 bg-card border rounded p-2 font-mono text-xs text-foreground overflow-x-auto">
          GITHUB_TOKEN=github_pat_…
        </pre>
      </li>
      <li>
        Restart the dev server, reload this page, click{" "}
        <strong>Test connection</strong>.
      </li>
    </ol>
  );
}
