const scopePost = {
  name: "scopePost",
  title: "Scope for Imagination Post",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Title",
      type: "string",
      initialValue: "scope for imagination",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "subtitle",
      title: "Subtitle",
      type: "string",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "entry",
      title: "Entry number",
      type: "string",
      description: "Four-digit entry number, e.g. 0002.",
      validation: (Rule) =>
        Rule.required().custom((value) => (/^\d{4}$/.test(value || "") ? true : "Use a four-digit entry number.")),
    },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      description: "Usually the same as the entry number until the site migrates to named slugs.",
      options: {
        source: "entry",
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    },
    {
      name: "publishedAt",
      title: "Published at",
      type: "datetime",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "location",
      title: "Location",
      type: "string",
      initialValue: "Cambridge, MA",
    },
    {
      name: "music",
      title: "Music",
      type: "object",
      description: "An optional song paired with the entry.",
      fields: [
        {
          name: "title",
          title: "Song title",
          type: "string",
          validation: (Rule) => Rule.required(),
        },
        {
          name: "artist",
          title: "Artist",
          type: "string",
          validation: (Rule) => Rule.required(),
        },
        {
          name: "url",
          title: "Link",
          type: "url",
          description: "Optional link to the song.",
          validation: (Rule) => Rule.uri({ scheme: ["http", "https"] }),
        },
      ],
    },
    {
      name: "status",
      title: "Status",
      type: "string",
      initialValue: "draft",
      options: {
        list: [
          { title: "Draft", value: "draft" },
          { title: "Published", value: "published" },
        ],
        layout: "radio",
      },
      validation: (Rule) => Rule.required(),
    },
    {
      name: "tags",
      title: "Tags",
      type: "array",
      of: [{ type: "string" }],
      options: {
        list: [
          { title: "Musings", value: "musings" },
          { title: "Life update", value: "life update" },
          { title: "Photography", value: "photography" },
          { title: "Cognitive science", value: "cognitive science" },
          { title: "Travel", value: "travel" },
          { title: "Faith", value: "faith" },
        ],
      },
    },
    {
      name: "excerpt",
      title: "Excerpt",
      type: "text",
      rows: 3,
      validation: (Rule) => Rule.max(240),
    },
    {
      name: "heroImage",
      title: "Hero image",
      type: "image",
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: "alt",
          title: "Alt text",
          type: "string",
        },
      ],
    },
    {
      name: "body",
      title: "Body",
      type: "blockContent",
      validation: (Rule) =>
        Rule.custom((value, context) => {
          if (Array.isArray(value) && value.length > 0) return true;
          return context.parent?.bodyHtml ? true : "Add body content or imported HTML.";
        }),
    },
    {
      name: "bodyHtml",
      title: "Imported HTML body",
      type: "text",
      rows: 12,
      description: "Optional fallback for posts written locally and uploaded from this repository.",
    },
    {
      name: "newsletter",
      title: "Newsletter",
      type: "object",
      fields: [
        {
          name: "subject",
          title: "Subject",
          type: "string",
          description: "Optional override. Defaults to title + subtitle when omitted.",
        },
        {
          name: "previewText",
          title: "Preview text",
          type: "string",
          validation: (Rule) => Rule.max(160),
        },
      ],
    },
  ],
  orderings: [
    {
      title: "Published, newest first",
      name: "publishedAtDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
    {
      title: "Entry number",
      name: "entryAsc",
      by: [{ field: "entry", direction: "asc" }],
    },
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "subtitle",
      entry: "entry",
      publishedAt: "publishedAt",
      media: "heroImage",
    },
    prepare(selection) {
      const { title, subtitle, entry, publishedAt, media } = selection;
      const date = publishedAt ? new Date(publishedAt).toLocaleDateString() : "unscheduled";
      return {
        title: subtitle ? `${title}: ${subtitle}` : title,
        subtitle: `${entry || "no entry"} • ${date}`,
        media,
      };
    },
  },
};

export default scopePost;
