import Image from "next/image";
import Link from "next/link";

<Link href="/" aria-label="Home">
  <Logo />
</Link>

export function Logo() {
  return (
    <div className="w-14 md:w-20">
      <Image
        src="/sand_dollar.png"
        alt="Frame It Wright Photography"
        width={160}
        height={160}
        className="h-auto w-full dark:invert dark:mix-blend-screen"
        priority
      />
    </div>
  );
}
