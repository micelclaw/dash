/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import type { NodeTypes } from '@xyflow/react';
import { RectangleShape } from './RectangleShape';
import { RoundedShape } from './RoundedShape';
import { DiamondShape } from './DiamondShape';
import { CircleShape } from './CircleShape';
import { CylinderShape } from './CylinderShape';
import { ParallelogramShape } from './ParallelogramShape';
import { HexagonShape } from './HexagonShape';
import { CloudShape } from './CloudShape';
import { DocumentShape } from './DocumentShape';
import { GroupShape } from './GroupShape';
import { StickyShape } from './StickyShape';
import { ImageShape } from './ImageShape';
import { TableShape } from './TableShape';
import { CardShape } from './CardShape';
import { BadgeShape } from './BadgeShape';
import { BannerShape } from './BannerShape';
import { TriangleShape } from './TriangleShape';
import { TrapezoidShape } from './TrapezoidShape';
import { PentagonShape } from './PentagonShape';
import { QueueShape } from './QueueShape';
import { StackShape } from './StackShape';
import { Database3dShape } from './Database3dShape';
import { ActorShape } from './ActorShape';
import { NoteShape } from './NoteShape';
import { SeparatorShape } from './SeparatorShape';
import { ServerShape } from './ServerShape';
import { DesktopShape } from './DesktopShape';
import { MobileShape } from './MobileShape';
import { RouterShape } from './RouterShape';
import { FirewallShape } from './FirewallShape';
import { MarkdownShape } from './MarkdownShape';
import { CodeBlockShape } from './CodeBlockShape';
import { LinkShape } from './LinkShape';
import { ListShape } from './ListShape';
import { EmbedShape } from './EmbedShape';

export const nodeTypes: NodeTypes = {
  rectangle: RectangleShape,
  rounded: RoundedShape,
  diamond: DiamondShape,
  circle: CircleShape,
  cylinder: CylinderShape,
  parallelogram: ParallelogramShape,
  hexagon: HexagonShape,
  cloud: CloudShape,
  document: DocumentShape,
  group: GroupShape,
  sticky: StickyShape,
  image: ImageShape,
  table: TableShape,
  card: CardShape,
  badge: BadgeShape,
  banner: BannerShape,
  triangle: TriangleShape,
  trapezoid: TrapezoidShape,
  pentagon: PentagonShape,
  queue: QueueShape,
  stack: StackShape,
  database3d: Database3dShape,
  actor: ActorShape,
  note: NoteShape,
  separator: SeparatorShape,
  server: ServerShape,
  desktop: DesktopShape,
  mobile: MobileShape,
  router: RouterShape,
  firewall: FirewallShape,
  markdown: MarkdownShape,
  codeblock: CodeBlockShape,
  link: LinkShape,
  list: ListShape,
  embed: EmbedShape,
};
