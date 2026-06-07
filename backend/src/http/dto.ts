/**
 * OpenAPI/Swagger DTOs for the REST surface.
 *
 * These classes exist ONLY to document the HTTP boundary. They are never instantiated —
 * the agent and services build the real payloads from `@partselect/types`. Each DTO
 * `implements` its shared interface, so if the contract in `packages/types` changes, these
 * stop compiling. That keeps the docs honest: the Swagger schema can't silently drift from
 * the types both apps actually use.
 *
 * Swagger reads metadata off class properties (decorators), which TypeScript interfaces
 * don't carry at runtime — hence the mirror classes here.
 */
import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import type {
  Availability,
  CartBlock,
  CartLine,
  ChatRequest,
  CompatResult,
  CompatVerdict,
  DoneEvent,
  ErrorEvent,
  InstallGuide,
  InstallStep,
  MetaEvent,
  OrderStatusBlock,
  ProductCard,
  SuggestedPrompts,
  TokenEvent,
  ToolEvent,
  TroubleshootBlock,
  TroubleshootCause,
  UIEvent,
  UnavailableBlock,
} from '@partselect/types';

const AVAILABILITY: Availability[] = ['InStock', 'OnOrder', 'SpecialOrder', 'Unknown'];
const COMPAT_VERDICT: CompatVerdict[] = ['COMPATIBLE', 'INCOMPATIBLE', 'UNKNOWN'];

/* ─── UI blocks (rendered by the frontend from real DB rows) ──────────────────────────── */

export class ProductCardDto implements ProductCard {
  @ApiProperty({ enum: ['product_card'], default: 'product_card' })
  kind!: 'product_card';

  @ApiProperty({ example: 'PS11752778', description: 'PartSelect part number' })
  ps_number!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Manufacturer part number' })
  mpn!: string | null;

  @ApiProperty({ type: String, nullable: true })
  name!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Whirlpool' })
  brand!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 24.99, description: 'null = call-for-price' })
  price!: number | null;

  @ApiProperty({ type: String, nullable: true, example: 'USD' })
  currency!: string | null;

  @ApiProperty({ enum: AVAILABILITY })
  availability!: Availability;

  @ApiProperty({ type: Number, nullable: true, example: 4.6 })
  rating!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 312 })
  review_count!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Product image URL' })
  image!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Filter' })
  part_type!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Refrigerator' })
  appliance!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Canonical PartSelect product page' })
  source_url!: string | null;

  @ApiProperty({ isArray: true, enum: ['view', 'add_to_cart'], description: 'Actions the UI may offer' })
  actions!: Array<'view' | 'add_to_cart'>;
}

export class CompatResultDto implements CompatResult {
  @ApiProperty({ enum: ['compat_result'], default: 'compat_result' })
  kind!: 'compat_result';

  @ApiProperty({ example: 'PS11752778' })
  ps_number!: string;

  @ApiProperty({ type: String, nullable: true })
  part_name!: string | null;

  @ApiProperty({ example: 'WDT780SAEM1', description: 'Appliance model number checked against' })
  model_number!: string;

  @ApiProperty({ enum: COMPAT_VERDICT })
  verdict!: CompatVerdict;

  @ApiProperty({ description: 'Grounded explanation of the verdict' })
  reason!: string;

  @ApiPropertyOptional({ type: () => ProductCardDto, nullable: true, description: 'Suggested alternative when incompatible' })
  suggested_part?: ProductCardDto | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  source_url?: string | null;
}

export class InstallStepDto implements InstallStep {
  @ApiProperty({ example: 1 })
  n!: number;

  @ApiProperty()
  text!: string;
}

export class InstallGuideDto implements InstallGuide {
  @ApiProperty({ enum: ['install_guide'], default: 'install_guide' })
  kind!: 'install_guide';

  @ApiProperty({ example: 'PS11752778' })
  ps_number!: string;

  @ApiProperty({ type: String, nullable: true })
  part_name!: string | null;

  @ApiProperty({ description: 'Whether a grounded guide exists for this part' })
  available!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Easy' })
  difficulty?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '15-30 mins' })
  time_estimate?: string | null;

  @ApiPropertyOptional({ type: [String] })
  tools?: string[];

  @ApiPropertyOptional({ type: () => [InstallStepDto] })
  steps?: InstallStepDto[];

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Embedded how-to video URL' })
  video_url?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  source_url?: string | null;
}

export class TroubleshootCauseDto implements TroubleshootCause {
  @ApiProperty({ example: 1, description: 'Likelihood rank (1 = most likely)' })
  rank!: number;

  @ApiProperty()
  cause!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'PS# of the part that addresses this cause' })
  recommended_ps?: string | null;
}

export class TroubleshootBlockDto implements TroubleshootBlock {
  @ApiProperty({ enum: ['troubleshoot'], default: 'troubleshoot' })
  kind!: 'troubleshoot';

  @ApiProperty({ example: 'Refrigerator' })
  appliance!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Whirlpool' })
  brand?: string | null;

  @ApiProperty({ example: 'ice maker not making ice' })
  symptom!: string;

  @ApiProperty({ type: () => [TroubleshootCauseDto] })
  causes!: TroubleshootCauseDto[];

  @ApiProperty({ type: () => [ProductCardDto], description: 'Real parts that fix the symptom' })
  parts!: ProductCardDto[];

  @ApiPropertyOptional({ type: () => [InstallStepDto] })
  repair_steps?: InstallStepDto[];

  @ApiProperty()
  safety_note!: string;
}

export class CartLineDto implements CartLine {
  @ApiProperty({ example: 'PS11752778' })
  ps_number!: string;

  @ApiProperty({ type: String, nullable: true })
  name!: string | null;

  @ApiProperty({ example: 1 })
  qty!: number;

  @ApiProperty({ type: Number, nullable: true, example: 24.99 })
  unit_price!: number | null;
}

export class CartBlockDto implements CartBlock {
  @ApiProperty({ enum: ['cart'], default: 'cart' })
  kind!: 'cart';

  @ApiProperty({ type: () => [CartLineDto] })
  items!: CartLineDto[];

  @ApiProperty({ example: 49.98 })
  subtotal!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Human note, e.g. "Added 2× …"' })
  note?: string | null;
}

export class OrderStatusBlockDto implements OrderStatusBlock {
  @ApiProperty({ enum: ['order_status'], default: 'order_status' })
  kind!: 'order_status';

  @ApiProperty({ example: 'PS-2026-0001' })
  order_number!: string;

  @ApiProperty({ example: 'Confirmed' })
  status!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '3-5 business days' })
  eta?: string | null;

  @ApiProperty({ type: [String], description: 'Line-item descriptions' })
  items!: string[];

  @ApiPropertyOptional({ type: Number, nullable: true, example: 49.98 })
  total?: number | null;
}

export class SuggestedPromptsDto implements SuggestedPrompts {
  @ApiProperty({ enum: ['suggested_prompts'], default: 'suggested_prompts' })
  kind!: 'suggested_prompts';

  @ApiProperty({ type: [String], description: 'Clickable starter prompts' })
  chips!: string[];
}

export class UnavailableBlockDto implements UnavailableBlock {
  @ApiProperty({ enum: ['unavailable'], default: 'unavailable' })
  kind!: 'unavailable';

  @ApiProperty({ example: 'order_status', description: 'The capability that has no verified data' })
  capability!: string;

  @ApiProperty({ description: 'Honest "I don\'t have verified X yet" message' })
  message!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  source_url?: string | null;
}

/** Every concrete UIBlock variant — referenced as a `oneOf` wherever the API emits blocks. */
export const UI_BLOCK_DTOS = [
  ProductCardDto,
  CompatResultDto,
  InstallGuideDto,
  TroubleshootBlockDto,
  CartBlockDto,
  OrderStatusBlockDto,
  SuggestedPromptsDto,
  UnavailableBlockDto,
] as const;

/* ─── SSE frames: NestJS → (Next proxy) → browser ─────────────────────────────────────── */

export class TokenEventDto implements TokenEvent {
  @ApiProperty({ enum: ['token'], default: 'token' })
  type!: 'token';

  @ApiProperty({ description: 'A streamed chunk of assistant prose' })
  text!: string;
}

export class ToolEventDto implements ToolEvent {
  @ApiProperty({ enum: ['tool'], default: 'tool' })
  type!: 'tool';

  @ApiProperty({ example: 'search_parts' })
  name!: string;

  @ApiProperty({ example: 'Searching catalog…', description: 'Status pill label' })
  label!: string;

  @ApiProperty({ enum: ['running', 'done', 'error'] })
  status!: 'running' | 'done' | 'error';
}

@ApiExtraModels(...UI_BLOCK_DTOS)
export class UIEventDto implements UIEvent {
  @ApiProperty({ enum: ['ui'], default: 'ui' })
  type!: 'ui';

  @ApiProperty({
    description: 'Typed blocks to render in-thread',
    type: 'array',
    items: { oneOf: UI_BLOCK_DTOS.map((d) => ({ $ref: getSchemaPath(d) })) },
  })
  blocks!: UIEvent['blocks'];
}

export class MetaEventDto implements MetaEvent {
  @ApiProperty({ enum: ['meta'], default: 'meta' })
  type!: 'meta';

  @ApiPropertyOptional()
  session_id?: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Captured appliance model number' })
  model_number?: string | null;

  @ApiPropertyOptional()
  turn_id?: string;
}

export class DoneEventDto implements DoneEvent {
  @ApiProperty({ enum: ['done'], default: 'done' })
  type!: 'done';
}

export class ErrorEventDto implements ErrorEvent {
  @ApiProperty({ enum: ['error'], default: 'error' })
  type!: 'error';

  @ApiProperty()
  message!: string;
}

export const CHAT_EVENT_DTOS = [
  TokenEventDto,
  ToolEventDto,
  UIEventDto,
  MetaEventDto,
  DoneEventDto,
  ErrorEventDto,
] as const;

/* ─── Request bodies ──────────────────────────────────────────────────────────────────── */

export class ChatRequestDto implements ChatRequest {
  @ApiProperty({ example: 'How can I install part number PS11752778?' })
  message!: string;

  @ApiPropertyOptional({ description: 'Omit to start a new session; the server returns the id in a meta frame' })
  session_id?: string;
}

export class CartAddDto {
  @ApiPropertyOptional({ description: 'Omit to start a new session' })
  session_id?: string;

  @ApiProperty({ example: 'PS11752778', description: 'PS# or MPN of the part to add' })
  ps_number!: string;

  @ApiPropertyOptional({ default: 1 })
  quantity?: number;
}

export class CartSetQtyDto {
  @ApiPropertyOptional()
  session_id?: string;

  @ApiProperty({ example: 'PS11752778' })
  ps_number!: string;

  @ApiProperty({ example: 2, description: 'Absolute quantity; 0 or less removes the line' })
  quantity!: number;
}

export class CartCheckoutDto {
  @ApiPropertyOptional()
  session_id?: string;
}

export class SessionClearDto {
  @ApiProperty({ description: 'Session to wipe (messages, cart, captured model number)' })
  session_id!: string;
}

/* ─── Response envelopes ──────────────────────────────────────────────────────────────── */

export class OkDto {
  @ApiProperty({ default: true })
  ok!: boolean;
}

export class ProductListDto {
  @ApiProperty({ type: () => [ProductCardDto] })
  items!: ProductCardDto[];
}

export class BrandFacetDto {
  @ApiProperty({ example: 'Whirlpool' })
  brand!: string;

  @ApiProperty({ example: 42, description: 'Count of in-scope products for this brand' })
  n!: number;
}

export class ApplianceFacetDto {
  @ApiProperty({ enum: ['Refrigerator', 'Dishwasher'] })
  appliance!: string;

  @ApiProperty({ example: 120 })
  n!: number;
}

export class FacetsDto {
  @ApiProperty({ type: () => [BrandFacetDto] })
  brands!: BrandFacetDto[];

  @ApiProperty({ type: () => [ApplianceFacetDto] })
  appliances!: ApplianceFacetDto[];
}

export class CartViewDto {
  @ApiProperty({ type: () => CartBlockDto })
  cart!: CartBlockDto;
}

export class CartMutationDto {
  @ApiProperty({ type: () => CartBlockDto })
  cart!: CartBlockDto;

  @ApiProperty({ description: 'Echoed session id (created if none was supplied)' })
  session_id!: string;

  @ApiPropertyOptional({ description: 'Whether the operation applied (e.g. false for call-for-price parts)' })
  ok?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  note?: string | null;
}

@ApiExtraModels(CartBlockDto, OrderStatusBlockDto)
export class CartCheckoutResultDto {
  @ApiProperty({
    description: 'An order_status block on success, or a cart block if the cart was empty',
    oneOf: [{ $ref: getSchemaPath(OrderStatusBlockDto) }, { $ref: getSchemaPath(CartBlockDto) }],
  })
  result!: OrderStatusBlockDto | CartBlockDto;

  @ApiProperty()
  session_id!: string;
}

export class TraceStepDto {
  @ApiProperty({ example: 'search_parts' })
  tool!: string;

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Tool input args' })
  args!: unknown;

  @ApiProperty({ example: 'search_parts:6 results' })
  result_summary!: string;

  @ApiProperty({ description: 'Step latency in ms' })
  ms!: number;
}

export class TraceRecordDto {
  @ApiProperty()
  turn_id!: string;

  @ApiProperty()
  session_id!: string;

  @ApiProperty()
  user_message!: string;

  @ApiProperty({ enum: ['fast', 'default', 'deep', '-'], description: 'Model tier that ran the turn' })
  model_tier!: string;

  @ApiProperty({ description: 'Scope verdict recorded for the turn' })
  scope_verdict!: string;

  @ApiProperty({ type: () => [TraceStepDto] })
  steps_json!: TraceStepDto[];

  @ApiPropertyOptional({ description: 'Time to first token (ms)' })
  ttft_ms?: number | null;

  @ApiPropertyOptional({ description: 'Total turn latency (ms)' })
  total_ms?: number | null;

  @ApiPropertyOptional()
  input_tokens?: number | null;

  @ApiPropertyOptional()
  output_tokens?: number | null;

  @ApiPropertyOptional({ description: 'Cached prompt tokens read (prompt-caching hit)' })
  cache_read_tokens?: number | null;
}
