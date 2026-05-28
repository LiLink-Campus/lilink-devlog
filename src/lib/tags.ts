export interface Tag {
  id: string;
  label: string;
  description?: string;
}

// The controlled tag registry. Posts reference tags by `id` (max 4 each).
export const tags = {
  product: { id: "product", label: "产品动态", description: "整体产品方向与节奏" },
  feature: { id: "feature", label: "新功能", description: "新增的功能与能力" },
  design: { id: "design", label: "设计", description: "界面与交互设计" },
  experience: { id: "experience", label: "体验优化", description: "流程顺手度与细节打磨" },
  privacy: { id: "privacy", label: "隐私安全", description: "账号、隐私与安全" },
  community: { id: "community", label: "校园社区", description: "社区与人和人的连接" },
  perks: { id: "perks", label: "校园福利", description: "优惠、权益与福利" },
  milestone: { id: "milestone", label: "里程碑", description: "重要节点与回顾" },
} satisfies Record<string, Tag>;

export type TagId = keyof typeof tags;

export const tagIds: ReadonlySet<string> = new Set(Object.keys(tags));

/** Resolve tag IDs to Tag records. Unknown IDs throw (build-time safety). */
export function resolveTags(ids: readonly string[]): Tag[] {
  return ids.map((id) => {
    const tag = (tags as Record<string, Tag>)[id];
    if (!tag) {
      throw new Error(
        `Unknown tag id "${id}". Allowed: ${[...tagIds].join(", ")}`,
      );
    }
    return tag;
  });
}

export function getTag(id: string): Tag | undefined {
  return (tags as Record<string, Tag>)[id];
}
