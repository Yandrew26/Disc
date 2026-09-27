"use client";

import { useState } from "react";
import { postAnnouncement } from "@/actions/announcement";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function PostAnnouncementForm({ teamId }: { teamId: string }) {
  const [isPoll, setIsPoll] = useState(false);
  const [options, setOptions] = useState(["", ""]);

  function setOption(i: number, value: string) {
    setOptions((o) => o.map((v, idx) => (idx === i ? value : v)));
  }

  return (
    <form action={postAnnouncement} className="mb-8 grid gap-2">
      <input type="hidden" name="teamId" value={teamId} />

      <Label htmlFor="feed-title">Title</Label>
      <Input id="feed-title" name="title" placeholder="e.g. Field change" />

      <Label htmlFor="feed-body">Announcement</Label>
      <Textarea id="feed-body" name="body" rows={2} required
        placeholder="e.g. Field changed to Turf 3 for Thursday" />

      <Label className="font-normal">
        <Checkbox checked={isPoll} onCheckedChange={(v) => setIsPoll(v === true)} />
        Add a poll
      </Label>

      {isPoll && (
        <div className="flex flex-col gap-1.5">
          {options.map((opt, i) => (
            <Input
              key={i}
              name="option"
              value={opt}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setOptions((o) => [...o, ""])}
          >
            Add option
          </Button>
        </div>
      )}

      <Button type="submit" size="sm" className="justify-self-start">
        Post
      </Button>
    </form>
  );
}
