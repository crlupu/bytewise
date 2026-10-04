"use client";

import { ReactNode, useMemo, useRef, useState } from "react";
import {
  BackIcon,
  CheckIcon,
  CodeIcon,
  GripIcon,
  HintIcon,
  InteractIcon,
  ReadIcon,
  SparkIcon,
  WrongIcon,
  GoalIcon,
} from "@/components/icons";
import { BlankAnswer, MatchAnswer, Options, OrderAnswer, TextAnswer, type Phase } from "@/components/steps/inputs";
import { Html } from "@/components/ui";
import { WIDGETS } from "@/components/widgets";
import { gradeBlank, gradeChoice, gradeMatch, gradeOptions, gradeOrder, gradePredict, type Verdict } from "@/lib/grade";
import { useReducedMotion } from "@/lib/settings";
import type { ExerciseStep, Step } from "@/lib/types";

const KIND: Record<Step["type"], { label: string; icon: typeof ReadIcon }> = {
  explanation: { label: "Read", icon: ReadIcon },
  choice: { label: "Multiple choice", icon: SparkIcon },
  predict: { label: "Predict the output", icon: CodeIcon },
  order: { label: "Put in order", icon: GripIcon },
  match: { label: "Match the pairs", icon: SparkIcon },
  blank: { label: "Fill in the blank", icon: CodeIcon },
  widget: { label: "Interactive", icon: InteractIcon },
};

export type StepEvents = {
  /** A Check was made; `hintsBefore` is how many hints were showing. */
  onAttempt?: (correct: boolean, hintsBefore: number, first: boolean) => void;
  onHint?: () => void;
  /** Move on. Called after a correct answer, or on an explanation. */
  onContinue: () => void;
  onBack?: () => void;
  /** The step was finished before, so the learner may move on without answering. */
  alreadyDone?: boolean;
  continueLabel?: string;
};

/**
 * One step: its content in the page body and its actions in the bar along
 * the bottom. Remounted for every step (keyed by the caller), so all of its
 * state — the answer, hints shown, attempts — starts fresh.
 */
export function StepView({ step, ...ev }: { step: Step } & StepEvents) {
  if (step.type === "explanation") {
    return (
      <>
        <div className="player__body">
          <div className="step-enter">
            {step.title && <h1 className="step__title">{step.title}</h1>}
            <Html className="prose" html={step.body} />
          </div>
        </div>
        <Foot>
          <Actions onBack={ev.onBack}>
            <button type="button" className="btn btn--primary" onClick={ev.onContinue} autoFocus>
              {ev.continueLabel ?? "Continue"}
            </button>
          </Actions>
        </Foot>
      </>
    );
  }
  return <Exercise step={step} {...ev} />;
}

function Foot({ children }: { children: ReactNode }) {
  return (
    <footer className="player__foot bar-material">
      <div className="player__foot-inner">{children}</div>
    </footer>
  );
}

function Actions({ onBack, children }: { onBack?: () => void; children: ReactNode }) {
  return (
    <div className="player__actions">
      {onBack && (
        <button type="button" className="btn btn--secondary" onClick={onBack} aria-label="Previous step">
          <BackIcon aria-hidden />
        </button>
      )}
      {children}
    </div>
  );
}

function initialAnswer(step: ExerciseStep): unknown {
  switch (step.type) {
    case "choice":
      return [];
    case "predict":
      return step.options ? [] : "";
    case "order":
      return step.start;
    case "match":
      return {};
    case "blank":
      return step.parts.filter((p) => "answers" in p).map(() => "");
    case "widget":
      return { state: null, picked: [] };
  }
}

type WidgetAnswer = { state: unknown; picked: number[] };

function ready(step: ExerciseStep, a: unknown): boolean {
  switch (step.type) {
    case "choice":
      return (a as number[]).length > 0;
    case "predict":
      return step.options ? (a as number[]).length > 0 : (a as string).trim().length > 0;
    case "order":
      return true;
    case "match":
      return Object.keys(a as object).length === step.left.length;
    case "blank":
      return (a as string[]).every((v) => v.trim());
    case "widget":
      return (a as WidgetAnswer).state !== null && (!step.question || (a as WidgetAnswer).picked.length > 0);
  }
}

function Exercise({ step, onAttempt, onHint, onContinue, onBack, alreadyDone, continueLabel }: { step: ExerciseStep } & StepEvents) {
  const [answer, setAnswer] = useState<unknown>(() => initialAnswer(step));
  const [phase, setPhase] = useState<Phase>("answering");
  const [verdict, setVerdict] = useState<(Verdict & { right?: boolean[] }) | null>(null);
  const [hints, setHints] = useState(0);
  const attempts = useRef(0);
  const reducedMotion = useReducedMotion();

  const widget = step.type === "widget" ? WIDGETS[step.widget] : null;
  const widgetConfig = useMemo(() => (widget && step.type === "widget" ? widget.config.parse(step.config) : null), [widget, step]);
  const widgetGoal = useMemo(() => (widget && step.type === "widget" && step.goal ? widget.goal.parse(step.goal) : undefined), [widget, step]);

  const change = (v: unknown) => {
    setAnswer(v);
    // Changing the answer after a miss starts the next try.
    if (phase === "wrong") {
      setPhase("answering");
      setVerdict(null);
    }
  };

  const grade = (): Verdict & { right?: boolean[] } => {
    switch (step.type) {
      case "choice":
        return gradeChoice(step, answer as number[]);
      case "predict":
        return gradePredict(step, step.options ? (answer as number[])[0] : (answer as string));
      case "order":
        return gradeOrder(step, answer as number[]);
      case "match":
        return gradeMatch(step, answer as Record<number, number>);
      case "blank":
        return gradeBlank(step, answer as string[]);
      case "widget": {
        const a = answer as WidgetAnswer;
        if (widgetGoal && widget) {
          const r = widget.check(widgetGoal as never, a.state as never, widgetConfig as never);
          if (!r.met) return { correct: false, text: r.why };
        }
        if (step.question) return gradeOptions(step.question.options, a.picked);
        return { correct: true };
      }
    }
  };

  const check = () => {
    if (phase !== "answering" || !ready(step, answer)) return;
    const v = grade();
    const first = attempts.current === 0;
    attempts.current++;
    onAttempt?.(v.correct, hints, first);
    setVerdict(v);
    setPhase(v.correct ? "correct" : "wrong");
  };

  const Kind = KIND[step.type];

  let input: ReactNode = null;
  switch (step.type) {
    case "choice":
      input = <Options options={step.options} multiple={step.multiple} value={answer as number[]} onChange={change} phase={phase} />;
      break;
    case "predict":
      input = step.options ? (
        <Options options={step.options} multiple={false} value={answer as number[]} onChange={change} phase={phase} />
      ) : (
        <TextAnswer value={answer as string} onChange={change} onSubmit={check} phase={phase} />
      );
      break;
    case "order":
      input = <OrderAnswer step={step} value={answer as number[]} onChange={change} phase={phase} />;
      break;
    case "match":
      input = <MatchAnswer step={step} value={answer as Record<number, number>} onChange={change} phase={phase} />;
      break;
    case "blank":
      input = <BlankAnswer step={step} value={answer as string[]} onChange={change} onSubmit={check} phase={phase} right={verdict?.right} />;
      break;
    case "widget": {
      const a = answer as WidgetAnswer;
      input = widget ? (
        <>
          <widget.Component
            config={widgetConfig as never}
            goal={widgetGoal as never}
            reducedMotion={reducedMotion}
            onState={(s: unknown) => {
              setAnswer((prev: unknown) => ({ ...(prev as WidgetAnswer), state: s }));
              // Moving the simulation after a miss starts the next try.
              setPhase((p) => (p === "wrong" ? "answering" : p));
              setVerdict((v) => (v && !v.correct ? null : v));
            }}
          />
          {step.question && (
            <div className="widget-question">
              <Html className="step__prompt prose" html={step.question.prompt} />
              <Options
                options={step.question.options}
                multiple={step.question.multiple}
                value={a.picked}
                onChange={(picked) => change({ ...a, picked })}
                phase={phase}
              />
            </div>
          )}
        </>
      ) : (
        <p className="notice notice--danger">Unknown widget “{step.widget}”.</p>
      );
      break;
    }
  }

  const feedback =
    phase === "correct" ? (
      <div className="feedback feedback--correct" role="status">
        <span className="feedback__icon">
          <CheckIcon aria-hidden />
        </span>
        <div>
          <p className="feedback__title">{attempts.current === 1 ? "Correct" : "That's it"}</p>
          {step.explanation && <Html className="feedback__body prose" html={step.explanation} />}
        </div>
      </div>
    ) : phase === "wrong" ? (
      <div className="feedback feedback--wrong" role="status">
        <span className="feedback__icon">
          <WrongIcon aria-hidden />
        </span>
        <div>
          <p className="feedback__title">Not quite</p>
          {verdict?.text && <p className="feedback__body">{verdict.text}</p>}
          {verdict?.feedback ? (
            <Html className="feedback__body prose" html={verdict.feedback} />
          ) : step.feedback ? (
            <Html className="feedback__body prose" html={step.feedback} />
          ) : (
            !verdict?.text && <p className="feedback__body">Have another look and try again.</p>
          )}
        </div>
      </div>
    ) : null;

  return (
    <>
      <div className="player__body">
        <div className="step-enter">
          <p className="step__kind">
            <Kind.icon aria-hidden />
            {Kind.label}
          </p>
          <Html className="step__prompt prose" html={step.prompt} />
          {(step.type === "choice" || step.type === "predict") && step.code && <Html className="step__code" html={step.code} />}
          {step.type === "widget" && widgetGoal !== undefined && (
            <p className="goal-line">
              <GoalIcon aria-hidden />
              <span>Reach the goal, then press Check.</span>
            </p>
          )}
          {input}
          {step.hints.length > 0 && (
            <div className="step__hint-row">
              {hints < step.hints.length && phase !== "correct" && (
                <button
                  type="button"
                  className="btn btn--plain btn--sm"
                  onClick={() => {
                    setHints((h) => h + 1);
                    onHint?.();
                  }}
                >
                  <HintIcon aria-hidden />
                  {hints === 0 ? "Show a hint" : `Another hint (${hints + 1} of ${step.hints.length})`}
                </button>
              )}
              {hints > 0 && (
                <div className="hints">
                  {step.hints.slice(0, hints).map((h, i) => (
                    <div className="hint" key={i}>
                      <HintIcon aria-hidden />
                      <Html className="prose" html={h} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Foot>
        {feedback}
        <Actions onBack={onBack}>
          {phase === "correct" ? (
            <button type="button" className="btn btn--primary" onClick={onContinue} autoFocus>
              {continueLabel ?? "Continue"}
            </button>
          ) : (
            <>
              {alreadyDone && (
                <button type="button" className="btn btn--secondary" onClick={onContinue}>
                  Skip
                </button>
              )}
              {phase === "wrong" ? (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setPhase("answering");
                    setVerdict(null);
                  }}
                  autoFocus
                >
                  Try again
                </button>
              ) : (
                <button type="button" className="btn btn--primary" onClick={check} disabled={!ready(step, answer)}>
                  Check
                </button>
              )}
            </>
          )}
        </Actions>
      </Foot>
    </>
  );
}
