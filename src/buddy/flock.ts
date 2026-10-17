import type { Doing } from "../agent/activity";
import type { AgentState } from "../agent/agent-model";
import { crewDone, crewUpdate, newCrew } from "./crew";
import { chickShare } from "./crew-chicks";
import { crewPose, crewWait, type PoseItem } from "./crew-pose";
import type { Crew } from "./crew-state";
import type { Screen } from "./ground";

// The herons of one pane: as many crews (crew.ts) as asked for while the
// pane has an agent, its subagents' chicks dealt out among them, and the
// ones no longer wanted (fewer asked for, or the agent gone) kept until
// they have faded out. Pure: the caller gives the screen and the time, and
// draws the pose.

/** What the herons know of the pane's agent. */
export interface FlockAgent {
  state: AgentState;
  doing: Doing | null;
  subagents: number;
}

/** The size of one terminal cell, in sprite pixels. */
export interface Cell {
  w: number;
  h: number;
}

export class Flock {
  private crews: Crew[] = [];

  get empty(): boolean {
    return this.crews.length === 0;
  }

  /** Moves every heron to now: `want` of them stay while there is an agent. */
  step(agent: FlockAgent | null, want: number, screen: Screen, cell: Cell, now: number): void {
    while (agent && this.crews.length < want) this.crews.push(newCrew(Math.random() * 2 ** 32, this.crews.length, now));
    this.crews.forEach((crew, i) => {
      const stays = agent !== null && i < want;
      crewUpdate(
        crew,
        {
          screen,
          present: stays,
          state: agent?.state ?? "idle",
          doing: agent?.doing ?? null,
          subagents: stays ? chickShare(agent.subagents, want, i) : 0,
          cellW: cell.w,
          cellH: cell.h,
        },
        now,
      );
    });
    const keep = agent ? want : 0;
    while (this.crews.length > keep && crewDone(this.crews[this.crews.length - 1])) this.crews.pop();
  }

  /** What to draw at now, back to front. */
  pose(now: number): PoseItem[] {
    return this.crews.flatMap((crew) => crewPose(crew, now));
  }

  /** How soon the next frame is needed, 0 for none. */
  wait(now: number): number {
    const waits = this.crews.map((crew) => crewWait(crew, now)).filter((w) => w > 0);
    return waits.length ? Math.min(...waits) : 0;
  }

  /** All herons go at once (Settings > Terminal herons off, or Animations off). */
  clear(): void {
    this.crews = [];
  }
}
