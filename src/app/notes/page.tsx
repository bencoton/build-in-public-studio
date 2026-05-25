import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRecentNotes } from "@/lib/notes";
import { getWatchedRepos } from "@/lib/settings";
import { relativeTime, displayProjectName } from "@/lib/format";

import { NoteForm } from "./note-form";
import { DeleteNoteButton } from "./delete-note-button";

// The notes page is a Server Component (no "use client" at the top). That means
// the database read happens server-side during render — no API route needed.
// The form below is a Client Component for its interactivity.

export default function NotesPage() {
  const notes = getRecentNotes(50);
  const watchedRepos = getWatchedRepos();

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">Notes</h2>
        <p className="text-base text-muted-foreground max-w-2xl">
          Quick capture for the things worth writing about later — the &quot;why&quot;
          behind your work that a git log will never see. Link each note to a
          project so it shows up in that project&apos;s draft generation.
        </p>
      </div>

      <NoteForm repos={watchedRepos} />

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Recent notes
        </h3>

        {notes.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No notes yet. The textarea above is where you write the first one.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li key={note.id}>
                <Card>
                  <CardContent className="py-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <Badge variant={note.repo ? "outline" : "secondary"}>
                          {note.repo ? displayProjectName(note.repo) : "General"}
                        </Badge>
                        <span className="text-muted-foreground">
                          {relativeTime(note.created_at)}
                        </span>
                      </div>
                      <DeleteNoteButton noteId={note.id} />
                    </div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {note.content}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
