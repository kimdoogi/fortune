/**
 * PUT /api/readings/:id/marks (F19): 족집게집 풀이 섹션마다 맞아요/아니에요를 표시만 남긴다.
 * LLM을 부르지 않고 하루 상한에 세지 않는다. 내 풀이만, 나는 어떤 사람 상품만.
 */
import { type MarkRequest, type MarksResponse, NATURE_SECTIONS } from "@fortune/shared-types";
import { z } from "zod";
import type { Env } from "../env";
import { HttpError, json, readBody } from "../http";
import type { User } from "../session";
import { findById, parseMarks } from "./store";

const MarkSchema = z.object({
  section: z.enum(NATURE_SECTIONS),
  mark: z.enum(["yes", "no"]).nullable(),
});

/** 표시 하나를 바꾼 새 표시 (null이면 지운다) */
export function applyMark(marks: MarksResponse["marks"], req: MarkRequest): MarksResponse["marks"] {
  const next = { ...marks };
  if (req.mark === null) delete next[req.section];
  else next[req.section] = req.mark;
  return next;
}

export async function setMark(id: string, req: Request, env: Env, user: User): Promise<Response> {
  const body: MarkRequest = await readBody(req, MarkSchema);
  const row = await findById(env, user.id, id);
  if (!row) throw new HttpError("NOT_FOUND", "풀이를 찾을 수 없어요");
  if (row.product !== "nature") throw new HttpError("INVALID_INPUT", "표시할 수 없는 풀이예요");
  const marks = applyMark(parseMarks(row.marks_json), body);
  await env.DB.prepare("UPDATE readings SET marks_json = ? WHERE id = ? AND user_id = ?")
    .bind(JSON.stringify(marks), id, user.id)
    .run();
  const out: MarksResponse = { marks };
  return json(out);
}
