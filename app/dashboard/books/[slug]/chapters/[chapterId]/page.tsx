"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ChapterEditPage({
  params,
}: {
  params: { slug: string; chapterId: string };
}) {
  const router = useRouter();
  const { slug, chapterId } = params;

  const [chapter, setChapter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", content: "" });

  // fetch chapter
  useEffect(() => {
    const fetchChapter = async () => {
      try {
        const res = await fetch(`/api/books/${slug}/chapters/${chapterId}`);
        if (!res.ok) throw new Error("Failed to fetch chapter");
        const data = await res.json();
        setChapter(data);
        setForm({
          title: data.title || "",
          content: typeof data.content === "object"
            ? JSON.stringify(data.content, null, 2)
            : data.content || "",
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchChapter();
  }, [slug, chapterId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/books/${slug}/chapters/${chapterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to update chapter");
      const updated = await res.json();
      setChapter(updated);
      alert("Chapter updated!");
    } catch (err) {
      console.error(err);
      alert("Error updating chapter");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this chapter?")) return;
    try {
      const res = await fetch(`/api/books/${slug}/chapters/${chapterId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete chapter");
      alert("Chapter deleted!");
      router.push(`/dashboard/books/${slug}`);
    } catch (err) {
      console.error(err);
      alert("Error deleting chapter");
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!chapter) return <p>Chapter not found</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Edit Chapter</h1>

      <Input
        name="title"
        value={form.title}
        onChange={handleChange}
        placeholder="Chapter Title"
      />

      <Textarea
        name="content"
        value={form.content}
        onChange={handleChange}
        placeholder="Chapter Content (JSON or text)"
        rows={10}
      />

      <div className="flex gap-2">
        <Button onClick={handleSave}>Save</Button>
        <Button variant="destructive" onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
