"use client";

import { FormEvent, useState } from "react";

type FormStatus = "idle" | "submitting" | "success" | "error";

type SelectOption = {
  label: string;
  value: string;
};

type ExtraField = {
  name: string;
  label: string;
  type?: "text" | "textarea";
  autoComplete?: string;
  maxLength?: number;
  placeholder?: string;
};

type NewsletterSignupProps = {
  endpoint?: string;
  successMessage?: string;
  description?: string;
  submitLabel?: string;
  submittingLabel?: string;
  interestName?: string;
  interestLabel?: string;
  interestOptions?: SelectOption[];
  extraFields?: ExtraField[];
};

const defaultInterestOptions = [
  { value: "everything", label: "everything" },
  { value: "life updates", label: "life updates" },
  { value: "musings", label: "musings" },
  { value: "cognitive science", label: "cognitive science" },
  { value: "photography", label: "photography" },
  { value: "travel and adventure", label: "travel and adventure" },
  { value: "faith", label: "faith" },
];

async function submitForm(endpoint: string, form: HTMLFormElement) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.fromEntries(new FormData(form))),
  });
  const result = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) throw new Error(result.message || "Something went wrong. Please try again.");
  return result.message;
}

export function NewsletterSignup({
  endpoint = "/api/newsletter/subscribe",
  successMessage = "You’re on the list—thank you!",
  description = "Occasional Scope for Imagination updates. Unsubscribe whenever you like.",
  submitLabel = "join the list",
  submittingLabel = "joining…",
  interestName = "interest",
  interestLabel = "most interested in",
  interestOptions = defaultInterestOptions,
  extraFields = [],
}: NewsletterSignupProps) {
  const [subscribeStatus, setSubscribeStatus] = useState<FormStatus>("idle");
  const [subscribeMessage, setSubscribeMessage] = useState("");
  const [unsubscribeStatus, setUnsubscribeStatus] = useState<FormStatus>("idle");
  const [unsubscribeMessage, setUnsubscribeMessage] = useState("");

  async function handleSubscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubscribeStatus("submitting");
    setSubscribeMessage("");
    try {
      setSubscribeMessage((await submitForm(endpoint, form)) || successMessage);
      setSubscribeStatus("success");
      form.reset();
    } catch (error) {
      setSubscribeStatus("error");
      setSubscribeMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  async function handleUnsubscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setUnsubscribeStatus("submitting");
    setUnsubscribeMessage("");
    try {
      setUnsubscribeMessage((await submitForm("/api/newsletter/unsubscribe", form)) || "You’ve been unsubscribed.");
      setUnsubscribeStatus("success");
      form.reset();
    } catch (error) {
      setUnsubscribeStatus("error");
      setUnsubscribeMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  const fieldClass =
    "w-full border border-stone-300 bg-transparent px-3 py-2 font-serif text-sm text-stone-900 outline-none focus:border-stone-500 dark:border-stone-700 dark:text-stone-100";

  return (
    <div>
      <form onSubmit={handleSubscribe} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs text-stone-400">
            <span className="block lowercase tracking-wider">first name</span>
            <input name="firstName" type="text" autoComplete="given-name" maxLength={80} className={fieldClass} />
          </label>
          <label className="space-y-1.5 text-xs text-stone-400">
            <span className="block lowercase tracking-wider">last name</span>
            <input name="lastName" type="text" autoComplete="family-name" maxLength={80} className={fieldClass} />
          </label>
        </div>

        <label className="block space-y-1.5 text-xs text-stone-400">
          <span className="block lowercase tracking-wider">email</span>
          <input name="email" type="email" autoComplete="email" required maxLength={254} className={fieldClass} />
        </label>

        <label className="block space-y-1.5 text-xs text-stone-400">
          <span className="block lowercase tracking-wider">{interestLabel}</span>
          <select name={interestName} defaultValue={interestOptions[0]?.value} className={fieldClass}>
            {interestOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        {extraFields.map((field) => (
          <label key={field.name} className="block space-y-1.5 text-xs text-stone-400">
            <span className="block lowercase tracking-wider">{field.label}</span>
            {field.type === "textarea" ? (
              <textarea
                name={field.name}
                maxLength={field.maxLength}
                placeholder={field.placeholder}
                className={`${fieldClass} min-h-24 resize-y`}
              />
            ) : (
              <input
                name={field.name}
                type="text"
                autoComplete={field.autoComplete}
                maxLength={field.maxLength}
                placeholder={field.placeholder}
                className={fieldClass}
              />
            )}
          </label>
        ))}

        <label className="hidden" aria-hidden="true">
          Company
          <input name="company" type="text" tabIndex={-1} autoComplete="off" />
        </label>

        <p className="text-xs leading-5 text-stone-500">{description}</p>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={subscribeStatus === "submitting"}
            className="border border-stone-400 px-4 py-2 font-serif text-xs lowercase tracking-widest text-stone-900 hover:border-stone-700 hover:text-[#6f8200] disabled:cursor-wait disabled:opacity-60 dark:border-stone-600 dark:text-stone-100 dark:hover:border-stone-300 dark:hover:text-[#6f8200]"
          >
            {subscribeStatus === "submitting" ? submittingLabel : submitLabel}
          </button>
          {subscribeMessage && (
            <p role="status" className={`text-xs ${subscribeStatus === "error" ? "text-red-700 dark:text-red-400" : "text-stone-450"}`}>
              {subscribeMessage}
            </p>
          )}
        </div>
      </form>

      <form onSubmit={handleUnsubscribe} className="mt-10 border-t border-stone-300 pt-6 dark:border-stone-700">
        <p className="font-serif text-sm lowercase tracking-widest text-stone-900 dark:text-stone-100">unsubscribe</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="unsubscribe-email">Email</label>
          <input id="unsubscribe-email" name="email" type="email" autoComplete="email" required placeholder="email address" className={fieldClass} />
          <button
            type="submit"
            disabled={unsubscribeStatus === "submitting"}
            className="whitespace-nowrap border border-stone-300 px-4 py-2 font-serif text-xs lowercase tracking-widest text-stone-900 hover:border-stone-500 hover:text-[#6f8200] disabled:cursor-wait disabled:opacity-60 dark:border-stone-700 dark:text-stone-100 dark:hover:border-stone-500 dark:hover:text-[#6f8200]"
          >
            {unsubscribeStatus === "submitting" ? "removing…" : "unsubscribe"}
          </button>
        </div>
        {unsubscribeMessage && (
          <p role="status" className={`mt-3 text-xs ${unsubscribeStatus === "error" ? "text-red-700 dark:text-red-400" : "text-stone-450"}`}>
            {unsubscribeMessage}
          </p>
        )}
      </form>
    </div>
  );
}
