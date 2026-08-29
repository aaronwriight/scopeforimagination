import type { Metadata } from "next";
import Link from "next/link";
import { ScienceShell, TopicDetails } from "@/components/science/science-content";

export const metadata: Metadata = {
  title: "cognitive science",
  description: "Research overview for Aaron Wright",
};

export default function CognitiveScienceOverviewPage() {
  return (
    <ScienceShell title="overview" subtitle="the social mind in dialogue">
      <p>
        <strong>
          I study the <span className="text-[#6f8200]"><em>social mind in dialogue</em></span>: how the human brain processes{" "}
          <span className="text-[#6f8200]"><em>language</em></span> and structures{" "}
          <span className="text-[#6f8200]"><em>conversation</em></span>.
        </strong>
      </p>

      <p>
        My interests and experiences have brought me to MIT&apos;s{" "}
        <Link href="https://bcs.mit.edu">Brain & Cognitive Sciences</Link> department and the{" "}
        <Link href="https://mcgovern.mit.edu">McGovern Institute for Brain Research</Link>, where I work with{" "}
        <Link href="https://www.evlab.mit.edu/about-ev">Ev Fedorenko</Link> and an incredible team of language scientists at{" "}
        <Link href="https://www.evlab.mit.edu">EvLab</Link>. While my research broadly aims to chart the footprints of language cognition in
        conversation, my interests follow a few primary trails:
      </p>

      <ul>
        <li>
          <TopicDetails
            title="Emotion & affect in conversation"
            question="How do we represent others' mental and emotional states during conversation, and how do these representations guide conversational behavior?"
          >
            <p>
              Conversation is one of the most natural, yet complex behaviors humans engage in. As people speak, they continuously signal
              attitudes, intentions, and emotional states through cues such as prosody, pauses, word choice, and facial expressions. My work asks
              how these emotional and mental-state representations are constructed during dialogue and how mechanisms like (mis)alignment shape the
              unfolding interaction between speakers.
            </p>
            <TopicDetails title="Reactivity" question="Why does communication elicit strong reactions between speakers?">
              <p>
                Conversation contains several unique cues that carry information about emotional states and social goals. I am interested in how
                these emotional experiences arise during conversation, how they are expressed through language and behavior, and how they influence
                the subsequent course of conversation.
              </p>
            </TopicDetails>
          </TopicDetails>
        </li>

        <li>
          <TopicDetails
            title="Miscommunication"
            question="Why do we miscommunicate, and how do we anticipate, identify, and repair miscommunication?"
          >
            <p>
              Conversation works remarkably well given how little meaning is stated explicitly. Speakers rely heavily on context, shared assumptions,
              and inference, rendering misinterpretation an inevitable feature of communication. I use neuroimaging and computational methods to
              investigate when and why miscommunication arises and how people collaboratively restore shared meaning.
            </p>
            <TopicDetails title="Repair" question="How do we anticipate and resolve miscommunication during linguistic communication?">
              <p>
                In dialogue, we routinely correct ourselves and others. Repair sequences reveal the strategies people use to track listeners&apos;
                understanding and update their own assumptions about what has been communicated.
              </p>
            </TopicDetails>
          </TopicDetails>
        </li>

        <li>
          <TopicDetails
            title="Culture & bilingualism"
            question="How does linguistic experience influence language cognition and communication?"
          >
            <p>
              Language experience shapes how people think, communicate, and interpret the world around them. Using neuroimaging and behavioral
              methods, I study how linguistic and sociocultural differences shape the brain and mind, helping us discern which aspects of human
              language are foundational versus flexible.
            </p>
          </TopicDetails>
        </li>
      </ul>

      <p>The brain&apos;s functional landscape is yet largely unexplored. Otherwise, if I&apos;m not doing science, I&apos;m probably hiking.</p>
    </ScienceShell>
  );
}
