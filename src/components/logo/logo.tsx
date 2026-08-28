import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" aria-label="Home" className="block w-14 text-stone-500 md:w-20">
      <span aria-hidden="true" className="sand-dollar-mark block aspect-square w-full" />
    </Link>
  );
}
