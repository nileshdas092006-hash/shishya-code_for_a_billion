"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createClassAction, type CreateClassState } from "../actions";
import { PrintButton } from "./PrintButton";

export function CreateClassForm() {
  const [state, action, pending] = useActionState<CreateClassState, FormData>(createClassAction, { status: "idle" });

  if (state.status === "created") {
    return (
      <section className="flex flex-col gap-5">
        <div className="card flex flex-col gap-3 border-green-700">
          <h2 className="text-2xl font-bold">
            Class {state.grade}
            {state.section} is ready
          </h2>
          <p className="text-xl">
            Class code: <strong className="math text-3xl">{state.classCode}</strong>
          </p>
          <p className="text-xl no-print">
            Teacher PIN: <strong className="math text-3xl">{state.pin}</strong>
          </p>
          <p className="msg-note no-print">
            Write the PIN down now. It is shown only once, and you need it to open this class on another computer.
          </p>
          <div className="flex flex-wrap gap-3 no-print">
            <PrintButton label="Print student codes" />
            <Link href={`/teacher/${encodeURIComponent(state.classCode)}`} className="btn btn-primary">
              Open the class board
            </Link>
          </div>
        </div>
        <StudentCodeSheet classCode={state.classCode} codes={state.studentCodes} />
      </section>
    );
  }

  return (
    <section className="card flex flex-col gap-4 no-print">
      <h2 className="text-2xl font-bold">Create a class</h2>
      <p>No names are entered anywhere. Each child gets a code. Keep the list that matches codes to names on paper.</p>
      <form action={action} className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 font-semibold">
          Class
          <select name="grade" defaultValue="8" className="field">
            <option value="7">7</option>
            <option value="8">8</option>
            <option value="9">9</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 font-semibold">
          Section
          <input name="section" required maxLength={1} pattern="[A-Za-z]" placeholder="B" className="field uppercase" />
        </label>
        <label className="flex flex-col gap-1 font-semibold">
          Number of students
          <input name="studentCount" type="number" min={1} max={60} defaultValue={40} required className="field" />
        </label>
        <button type="submit" className="btn btn-primary sm:col-span-3 justify-self-start" disabled={pending}>
          Create class and codes
        </button>
      </form>
      <p className="text-base text-gray-700">Class 7 children are under 13, so Class 7 never gets an AI chat.</p>
      {state.status === "error" && (
        <p role="alert" className="msg-bad">
          {state.message}
        </p>
      )}
    </section>
  );
}

export function StudentCodeSheet({ classCode, codes }: { classCode: string; codes: string[] }) {
  return (
    <section aria-label="Student codes" className="flex flex-col gap-3">
      <h2 className="text-2xl font-bold">Student codes for class code {classCode}</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {codes.map((code) => (
          <li key={code} className="print-codes border-2 border-dashed border-gray-500 rounded-lg p-3 flex flex-col">
            <span className="text-sm text-gray-700">Class code: {classCode}</span>
            <span className="math text-2xl font-bold">{code}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
