import Image from "next/image";
import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" aria-label="Home" className="block w-14 md:w-20">
      <Image
        src="/sand_dollar_cutout.png"
        alt=""
        width={160}
        height={160}
        className="h-auto w-full transition-[filter] dark:grayscale dark:brightness-[0.47] dark:contrast-[1.03]"
        priority
      />
    </Link>
  );
}
