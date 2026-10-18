import { CreateClassForm } from "./CreateClassForm";
import { TeacherPinForm } from "./TeacherPinForm";

// Teacher start page. No names are ever entered: students get printed codes like 8B-01.

export default function TeacherHome() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-extrabold no-print">Teacher</h1>
      <CreateClassForm />
      <section className="card flex flex-col gap-4 no-print">
        <h2 className="text-2xl font-bold">Open my class</h2>
        <TeacherPinForm />
      </section>
    </div>
  );
}
