"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { useProject } from "@/lib/context/project-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from "date-fns";
import Link from "next/link";

interface CalendarEvent {
  id: string;
  title: string | null;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  projects?: { name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  publishing: "bg-yellow-100 text-yellow-700",
  published: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

function CalendarPage() {
  const searchParams = useSearchParams();
  const { projectId: contextProjectId, project } = useProject();
  const projectId = searchParams.get("projectId") ?? contextProjectId;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const fetchEvents = useCallback(async () => {
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    const params = new URLSearchParams({ month: String(month), year: String(year) });
    if (projectId) params.set("projectId", projectId);
    const res = await fetch(`/api/calendar?${params}`);
    const data = await res.json();
    setEvents(data.events ?? []);
  }, [currentDate, projectId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  const startPadding = getDay(startOfMonth(currentDate));

  function getEventsForDay(day: Date) {
    return events.filter((e) => {
      const date = e.scheduled_at ?? e.published_at;
      return date && isSameDay(new Date(date), day);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title={project ? `${project.name} — Calendar` : "Content Calendar"} description="Schedule and track your content pipeline">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium w-32 text-center">{format(currentDate, "MMMM yyyy")}</span>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
        </div>
      </PageHeader>

      <Card className="overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-3 py-2 text-xs font-medium text-muted-foreground text-center">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {/* Padding cells */}
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[120px] border-b border-r bg-muted/20 p-1" />
          ))}

          {days.map((day) => {
            const dayEvents = getEventsForDay(day);
            const isToday = isSameDay(day, new Date());
            const inMonth = isSameMonth(day, currentDate);
            return (
              <div key={day.toISOString()} className={`min-h-[120px] border-b border-r p-1.5 ${!inMonth ? "bg-muted/20" : ""}`}>
                <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <Link key={e.id} href={`/content/${e.id}`}>
                      <div className={`truncate rounded px-1.5 py-0.5 text-xs cursor-pointer hover:opacity-80 ${STATUS_COLORS[e.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {e.title ?? "Untitled"}
                      </div>
                    </Link>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground px-1.5">+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(STATUS_COLORS).map(([status, cls]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`h-3 w-3 rounded-sm ${cls}`} />
            <span className="text-xs text-muted-foreground capitalize">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CalendarPageWrapper() {
  return (
    <Suspense>
      <CalendarPage />
    </Suspense>
  );
}
