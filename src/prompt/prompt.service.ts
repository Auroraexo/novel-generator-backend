import { Injectable } from '@nestjs/common';
import {
  SYSTEM_PROMPT,
  GLOBAL_FORBIDDEN,
  GENRE_STYLES,
  PACING_TEMPLATES,
} from './prompt.constants';

export interface SettingInput {
  genre: string;
  subgenre: string;
  inspiration: string;
  targetChapters: number;
  targetWords: number;
}

export interface ChapterContext {
  index: number;
  targetWords: number;
  settingCompact: string;
  outlineSummary: string;
  currentOutline: string;
  prevChapterTail: string;
  cumulativeSummary: string;
  pendingForeshadowing: string;
  genre: string;
}

@Injectable()
export class PromptService {
  getSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  buildSettingPrompt(input: SettingInput): string {
    return `【任务】
基于以下题材与灵感，生成一份完整的短篇小说设定档案。

【题材】${input.genre} - ${input.subgenre}
【灵感】${input.inspiration}
【篇幅】共 ${input.targetChapters} 章，约 ${input.targetWords} 字/章

【要求】
1. 主角设定要有"反差感"和"代入感"，不要完美无缺
2. 至少包含 1 个核心冲突 + 2 个次要冲突
3. 世界观规模匹配短篇体量，不要构建过于宏大的设定
4. 主角的核心目标必须在 ${input.targetChapters} 章内可达成

【输出格式】严格按以下 JSON 结构输出，不要添加任何解释：

{
  "title": "小说标题（6-12 字，有钩子）",
  "logline": "一句话故事梗概（30 字内）",
  "tone": "整体基调（如：甜虐交织、热血爽文、暗黑悬疑）",
  "protagonist": {
    "name": "姓名",
    "age": 0,
    "identity": "身份职业",
    "personality": "性格关键词 3-5 个",
    "motivation": "核心动机",
    "flaw": "主要缺陷或弱点"
  },
  "antagonist": {
    "name": "姓名",
    "identity": "身份",
    "goal": "对立目标",
    "relationship": "与主角的关系"
  },
  "supporting_cast": [
    {"name": "", "role": "（如：闺蜜/师父/反派打手）", "function": "在故事中的功能"}
  ],
  "world_setting": {
    "time_space": "时空背景一句话",
    "key_rules": ["世界观核心规则 1", "规则 2"],
    "key_locations": ["主要场景 1", "场景 2", "场景 3"]
  },
  "core_conflict": "核心冲突（贯穿全篇）",
  "secondary_conflicts": ["次要冲突 1", "次要冲突 2"],
  "story_arc": {
    "opening_hook": "开篇 500 字内的钩子事件",
    "midpoint_twist": "中段（第 6-7 章）的关键反转",
    "climax": "高潮（倒数第 2 章）的决定性场面",
    "resolution": "结局收束方式"
  },
  "selling_points": ["卖点 1（如：先婚后爱）", "卖点 2", "卖点 3"]
}`;
  }

  buildOutlinePrompt(settingJson: string, targetChapters: number): string {
    const pacing = this.getPacingTemplate(targetChapters);

    return `【任务】
基于以下故事设定，为这部 ${targetChapters} 章短篇生成完整章纲。

【故事设定】
${settingJson}

【节奏要求】
${pacing}

【强制要求】
1. 必须输出 ${targetChapters} 章，不多不少
2. 每章末尾必须留钩子（悬念/反转/情绪爆点），引导读者读下一章
3. 主线冲突必须贯穿，每章至少推进一次
4. 第 1 章前 500 字必须有强钩子，禁止平铺直叙
5. 中段反转（第 6-7 章）必须改变主角处境
6. 高潮章节（倒数第 2 章）必须有"决定性场面"
7. 不要在章纲里写出完整对话，只写情节走向

【输出格式】严格按以下 JSON 数组输出，每个元素为一章：

[
  {
    "index": 1,
    "title": "章节标题（8-15 字，有画面感或悬念）",
    "scene": "主场景（一句话，时间+地点）",
    "characters": ["出场角色 1", "角色 2"],
    "goal": "本章主角想要达成的目标",
    "conflict": "本章冲突点（与谁/与什么对抗）",
    "key_events": ["关键事件 1", "关键事件 2", "关键事件 3"],
    "emotional_beat": "本章情绪基调",
    "payoff": "本章爽点 / 信息揭示 / 情感推进（至少 1 个）",
    "ending_hook": "章末钩子（具体描述，必须能引导读者读下一章）",
    "foreshadowing": ["埋下的伏笔（可空数组）"],
    "callback": ["回收的伏笔（前几章埋的，可空数组）"]
  }
]`;
  }

  buildOutlineRegeneratePrompt(
    settingJson: string,
    fullOutline: string,
    prevChapter: string | null,
    nextChapter: string | null,
    index: number,
    userFeedback: string,
  ): string {
    return `【任务】
重新生成第 ${index} 章的章纲。

【故事设定】${settingJson}
【全本章纲】${fullOutline}
${prevChapter ? `【上一章纲要】${prevChapter}` : ''}
${nextChapter ? `【下一章纲要】${nextChapter}` : ''}
【用户的修改诉求】${userFeedback}

【要求】
- 必须与前后章保持因果连续
- 必须满足用户修改诉求
- 输出格式同章纲单元（单个 JSON 对象）`;
  }

  buildChapterPrompt(ctx: ChapterContext): string {
    const genreStyle = this.getGenreStyle(ctx.genre);

    return `【任务】
基于以下信息创作第 ${ctx.index} 章正文，目标字数 ${ctx.targetWords} 字（±10% 可接受）。

【故事设定】
${ctx.settingCompact}

【全本章纲速览】
${ctx.outlineSummary}

【本章详细蓝图】
${ctx.currentOutline}

【上一章末尾衔接】
${ctx.prevChapterTail || '（第一章，无前文）'}

【前文累积摘要】
${ctx.cumulativeSummary || '（第一章，无前文摘要）'}

【待回收伏笔】
${ctx.pendingForeshadowing || '（暂无）'}

${genreStyle}

【创作要求】
1. 严格按本章蓝图的 key_events 顺序推进，不擅自增删主线事件
2. 必须实现蓝图中的 payoff（爽点/信息揭示/情感推进）
3. 章末必须落在蓝图指定的 ending_hook 上
4. 用 60% 篇幅写场景动作和对话，30% 心理与画面，10% 必要交代
5. 对话要符合人物身份和性格设定，避免 AI 腔
6. 段落短促，单段不超过 4 行，单句不超过 30 字
7. 字数控制在 ${ctx.targetWords} 字左右
8. 不写"上一章…"、"接下来…"等元叙述
9. 不输出标题（标题已由系统管理）

【禁止事项】
- 禁止使用"突然"、"忽然"、"不经意间"作为转折开头超过 1 次
- 禁止 AI 常见套话："命运的齿轮开始转动"、"故事才刚刚开始"等
- 禁止角色性格突变（必须与设定一致）
- 禁止破坏世界观规则
- 禁止剧透后续章节内容

${GLOBAL_FORBIDDEN}

【输出格式】纯文本正文，直接开始，不加任何前后缀、不加标题、不加 Markdown 标记。`;
  }

  buildChapterRewritePrompt(
    ctx: ChapterContext,
    previousVersion: string,
    userFeedback: string,
    keepElements: string,
  ): string {
    const base = this.buildChapterPrompt(ctx);
    return `${base}

【重写信息】
【上一版正文】${previousVersion}
【用户反馈】${userFeedback}
【保留要素】${keepElements}

【重写要求】
- 严格响应用户反馈进行调整
- 保留上述列出的情节和场景
- 不得违反章纲蓝图的核心走向`;
  }

  buildSummaryPrompt(chapterContent: string, outlineJson: string, index: number): string {
    return `【任务】
将以下章节正文压缩成结构化摘要。

【正文】
${chapterContent}

【本章蓝图】
${outlineJson}

【输出格式】严格按以下 JSON 结构，不要添加解释：

{
  "index": ${index},
  "one_line_summary": "一句话概括本章（30 字内）",
  "key_facts": [
    "本章发生的关键事实 1（影响后续剧情的）",
    "事实 2",
    "事实 3"
  ],
  "character_state_changes": [
    {"name": "角色名", "change": "状态/关系/认知发生的变化"}
  ],
  "new_foreshadowing": ["本章新埋的伏笔"],
  "resolved_foreshadowing": ["本章回收的伏笔"],
  "world_state_delta": "世界观/格局发生的变化（无则填 null）",
  "emotional_residue": "本章留给读者的情绪余韵",
  "next_chapter_setup": "为下一章铺垫的关键状态"
}`;
  }

  buildMidMergePrompt(threeSummaries: string): string {
    return `【任务】将以下 3 章摘要合并为一段连贯的"阶段叙事"，控制在 200 字内。
【章节摘要】${threeSummaries}
【输出】纯文本，一段话，不加标题。`;
  }

  buildExpandPrompt(content: string, targetWords: number): string {
    return `【任务】对以下正文进行扩写，使总字数达到 ${targetWords} 字。
【已有正文】${content}
【扩写要求】
- 不增加新情节，只丰富现有场景的细节、动作、对话、心理
- 保持原有节奏和钩子
- 重点扩充：场景描写、对话张力、关键动作的慢镜头`;
  }

  buildTrimPrompt(content: string, targetWords: number): string {
    return `【任务】对以下正文进行精简，使总字数控制在 ${targetWords} 字内。
【已有正文】${content}
【精简要求】
- 优先删除：冗余形容词、重复心理活动、与主线无关的场景
- 保留：关键事件、核心对话、ending_hook
- 不删除任何 key_events 中列出的情节节点`;
  }

  private getPacingTemplate(chapters: number): string {
    if (chapters <= 10) return PACING_TEMPLATES[10];
    if (chapters <= 12) return PACING_TEMPLATES[12];
    return PACING_TEMPLATES[15];
  }

  private getGenreStyle(genre: string): string {
    for (const [key, style] of Object.entries(GENRE_STYLES)) {
      if (genre.includes(key)) return style;
    }
    return '';
  }
}
