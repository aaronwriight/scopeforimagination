"use client";

import Link from "next/link";
import { useState } from "react";

type Section = "art" | "communities" | "creative";

const sectionLabels: Array<[Section, string]> = [
  ["art", "art & media"],
  ["communities", "communities"],
  ["creative", "creative initiatives & inspirations"],
];

export function PersonalDropdowns() {
  const [openSection, setOpenSection] = useState<Section | null>(null);

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {sectionLabels.map(([section, label], index) => (
          <span key={section} className="contents">
            {index > 0 && <span className="text-stone-400">|</span>}
            <button
              type="button"
              aria-expanded={openSection === section}
              onClick={() => setOpenSection((current) => (current === section ? null : section))}
              className="cursor-pointer bg-transparent p-0 font-serif text-sm text-[#6f8200] hover:underline"
            >
              {label}
            </button>
          </span>
        ))}
      </div>

      {openSection === "art" && (
        <div className="mt-5 space-y-5">
          <div>
            <p><strong>artists &amp; albums</strong></p>
            <ul>
              <li><Link href="https://open.spotify.com/album/7EOvtHDxbltA0GNC4mvLAC"><em>The Definition</em></Link>, Jon Bellion</li>
              <li><Link href="https://open.spotify.com/album/1HiN2YXZcc3EjmVZ4WjfBk"><em>Everybody</em></Link>, Logic</li>
              <li><Link href="https://open.spotify.com/album/6B3LAqHoBKmSN9HLbyy0Ro"><em>Change of Scenery II</em></Link>, Quinn XCII</li>
              <li><Link href="https://open.spotify.com/album/2UrPmvaX5X76LIzE6Cfiqu"><em>Brol La Suite</em></Link>, Angele</li>
              <li><Link href="https://open.spotify.com/album/42SAgjuUp25kQT9I04ph1w"><em>Rainbow Mixtape</em></Link>, COIN</li>
              <li><Link href="https://open.spotify.com/album/1k7iymTuRK6I4tvn0SX38I"><em>Songs For The Canyon</em></Link>, John Vincent III</li>
              <li><Link href="https://open.spotify.com/album/7eqdUZuRuOkurhzRWr6YUn"><em>True Love</em></Link>, Crystal Gayle</li>
              <li><Link href="https://open.spotify.com/album/7FghAqLEF3Qvjv91tcwKTc"><em>From The Valley</em></Link>, Ilsey</li>
              <li><Link href="https://open.spotify.com/album/4QszKQEmQxFd6km1COQaoI"><em>Devotion [Deluxe]</em></Link>, Sunday (1994)</li>
              <li><Link href="https://open.spotify.com/album/4nYVLUVhQb9bD7l1QlYoFS"><em>Vice City Magic</em></Link>, Mustard Service</li>
              <li><Link href="https://open.spotify.com/track/2aGNR8A6GnHqoM78T31CCC"><em>High Highs to Low Lows</em></Link>, Lolo Zouaï</li>
              <li><Link href="https://open.spotify.com/album/27SQuR7jPiGkJJXl8njEqY"><em>Jean</em></Link>, Yebba</li>
              <li><Link href="https://open.spotify.com/album/4J8jmljF3FvpyhPjyB1fae"><em>Cape God</em></Link>, Allie X</li>
              <li><Link href="https://open.spotify.com/album/5RUma3H9uzDLXxwT7JzTel"><em>Essex Honey</em></Link>, Blood Orange</li>
              <li><Link href="https://open.spotify.com/album/25ktFe8igqIwv9aRbkdnTS"><em>Desire, I Want To Turn Into You: Everasking Edition</em></Link>, Caroline Polachek</li>
              <li><Link href="https://open.spotify.com/album/4f3yGbwInBCKTfop0dLrkC"><em>I Miss You, I Do</em></Link>, Arny Margret</li>
              <li><Link href="https://open.spotify.com/album/4ByOqAhq3BuBo0sN54XkEQ"><em>Good at Falling</em></Link>, The Japanese House</li>
              <li><Link href="https://open.spotify.com/album/35tILwApqYtN9fTJq2v7M3"><em>brent iii</em></Link>, Jeremy Zucker &amp; Chelsea Cutler</li>
              <li><Link href="https://open.spotify.com/album/0vrIRUpI2gB2QqOUQEG05v"><em>Grand Romantic</em></Link>, Nate Ruess</li>
              <li><Link href="https://open.spotify.com/album/2eN97mVJc9gsJqmHnHpInv"><em>Honey</em></Link>, Samia</li>
              <li><Link href="https://open.spotify.com/album/37ABUtLPqktcopsBJ7jmXT"><em>Oh Wonder</em></Link>, Oh Wonder</li>
              <li><Link href="https://open.spotify.com/album/79thwyFL6Uo6rgTp3YWEAf"><em>Women In Music, Pt. III (Expanded Edition)</em></Link>, HAIM</li>
            </ul>
          </div>

          <div>
            <p><strong>film</strong></p>
            <ul>
              <li><i>La La Land</i></li>
              <li><i>A Quiet Place</i></li>
              <li><i>Good Will Hunting</i></li>
              <li><i>Spirited Away</i></li>
            </ul>
          </div>

          <div>
            <p><strong>literature</strong></p>
            <ul>
              <li><em>Anne of Green Gables</em>, Lucy Maud Montgomery</li>
              <li><em>The Haunting of Hill House</em>, Shirley Jackson</li>
              <li><em>A Girl of the Limberlost</em>, Gene Stratton-Porter</li>
              <li><em>I&apos;m Glad My Mom Died</em>, <Link href="https://www.jennettemccurdy.com/">Jennette McCurdy</Link></li>
            </ul>
          </div>

          <div>
            <p><strong>podcasts</strong></p>
            <ul>
              <li>Pocket-sized science with hand-picked experts: <Link href="https://www.alieward.com">Ologies with Alie Ward</Link></li>
            </ul>
          </div>
        </div>
      )}

      {openSection === "communities" && (
        <ul className="mt-5">
          <li>My home away from science: <Link href="https://lavidacenter.org">La Vida At Gordon College</Link></li>
          <li>Nurturing inclusivity, presence, and creativity: <Link href="https://compasspath.org">Compass</Link></li>
        </ul>
      )}

      {openSection === "creative" && (
        <div className="mt-5 space-y-5">
          <div>
            <p><strong>traditional &amp; digital media</strong></p>
            <ul>
              <li>
                <Link href="https://www.etsy.com/shop/PhebeSunriseStudio">Phebe Sunrise Studio</Link>, a Maine-inspired print shop by Kennebunk,
                ME-based artist (and long-time friend), <Link href="https://www.instagram.com/phebegrant.art/">Phebe Grant</Link>
              </li>
              <li>Mesmerizing paintings and sketches done by my friend, <Link href="https://www.instagram.com/jameswellborn.art/">James Wellborn</Link></li>
              <li>A carousel of creative services, inspiration, and encouragement by my friend, <Link href="https://www.melissazaldivar.com/">Melissa Zaldivar Sawyer</Link></li>
            </ul>
          </div>

          <div>
            <p><strong>photography &amp; visual storytelling</strong></p>
            <ul>
              <li>My talented friend and storyteller, Eden Harfield, at <Link href="https://www.edengracecreative.com">Eden Grace Creative</Link></li>
              <li><Link href="https://www.instagram.com/newnativephotography/">New Native Photography</Link>: elopement and weddings, captured by my friend, Lindsey Tillman</li>
              <li>Stunning landscape photography by <Link href="https://www.frihead.ch/">Mathilde Rietsch</Link></li>
              <li>
                Grammy-nominated recording engineer, producer, and audio engineer (and photographer behind many of my sources of inspiration),{" "}
                <Link href="https://www.instagram.com/bellaicecream/?hl=en">Bella Blasko</Link>
              </li>
            </ul>
          </div>

          <div>
            <p><strong>data visualization</strong></p>
            <ul>
              <li>Data visualization and information design by <Link href="https://www.cedricscherer.com">Cédric Scherer</Link></li>
              <li>Transforming data into understanding: <Link href="https://nrennie.rbind.io">Nicola Rennie</Link></li>
            </ul>
          </div>

          <div>
            <p><strong>independent projects &amp; design</strong></p>
            <ul>
              <li>The independent design studio, <Link href="https://houseofdakh.com/">HOUSEOFDAKH</Link></li>
              <li>Jon Bellion&apos;s <Link href="https://www.beautifulmindprojects.com/">Beautiful Mind Projects</Link></li>
              <li>Classical composer, <Link href="https://www.christopherdenniscoleman.com/">Christopher Dennis Coleman</Link></li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
