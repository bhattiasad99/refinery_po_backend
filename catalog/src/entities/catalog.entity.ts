import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { Category } from "./category.entity";
import { Supplier } from "./supplier.entity";

const decimalTransformer = {
  to: (value: number) => value,
  from: (value: string): number => Number(value),
};

@Entity({ name: "catalog" })
export class Catalog {
  @PrimaryColumn({ type: "varchar", length: 140 })
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ name: "category_name", type: "varchar", length: 120 })
  categoryName!: string;

  @ManyToOne(() => Category, (category) => category.catalogs, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "category_name", referencedColumnName: "name" })
  category!: Category;

  @Column({ name: "supplier_name", type: "varchar", length: 160 })
  supplierName!: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.catalogs, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "supplier_name", referencedColumnName: "name" })
  supplier!: Supplier;

  @Column({ name: "created_by", type: "varchar", length: 140 })
  createdBy!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  manufacturer!: string | null;

  @Column({ type: "varchar", length: 255 })
  model!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ name: "lead_time_days", type: "integer" })
  leadTimeDays!: number;

  @Column({
    name: "price_usd",
    type: "numeric",
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  priceUsd!: number;

  @Column({ name: "in_stock", type: "boolean", default: false })
  inStock!: boolean;

  @Column({ name: "compatible_with", type: "text", array: true, nullable: true })
  compatibleWith!: string[] | null;

  @Column({ type: "text", nullable: true })
  standard!: string | null;

  @Column({ name: "specs_supplier", type: "text", nullable: true })
  specsSupplier!: string | null;

  @Column({ name: "nominal_size", type: "text", nullable: true })
  nominalSize!: string | null;

  @Column({ name: "pressure_class", type: "text", nullable: true })
  pressureClass!: string | null;

  @Column({ type: "text", nullable: true })
  face!: string | null;

  @Column({ name: "winding_material", type: "text", nullable: true })
  windingMaterial!: string | null;

  @Column({ name: "filler_material", type: "text", nullable: true })
  fillerMaterial!: string | null;

  @Column({ name: "inner_ring", type: "text", nullable: true })
  innerRing!: string | null;

  @Column({ name: "outer_ring", type: "text", nullable: true })
  outerRing!: string | null;

  @Column({ name: "ring_number", type: "text", nullable: true })
  ringNumber!: string | null;

  @Column({ type: "text", nullable: true })
  profile!: string | null;

  @Column({ type: "text", nullable: true })
  material!: string | null;

  @Column({ type: "text", nullable: true })
  thickness!: string | null;

  @Column({ name: "sheet_size", type: "text", nullable: true })
  sheetSize!: string | null;

  @Column({ name: "max_temperature", type: "text", nullable: true })
  maxTemperature!: string | null;

  @Column({ name: "core_material", type: "text", nullable: true })
  coreMaterial!: string | null;

  @Column({ name: "facing_material", type: "text", nullable: true })
  facingMaterial!: string | null;

  @Column({ name: "body_material", type: "text", nullable: true })
  bodyMaterial!: string | null;

  @Column({ name: "end_connection", type: "text", nullable: true })
  endConnection!: string | null;

  @Column({ name: "trim_or_seat", type: "text", nullable: true })
  trimOrSeat!: string | null;

  @Column({ type: "text", nullable: true })
  nace!: string | null;

  @Column({ name: "fire_safe", type: "text", nullable: true })
  fireSafe!: string | null;

  @Column({ name: "hydraulic_size", type: "text", nullable: true })
  hydraulicSize!: string | null;

  @Column({ type: "text", nullable: true })
  configuration!: string | null;

  @Column({ name: "casing_material", type: "text", nullable: true })
  casingMaterial!: string | null;

  @Column({ name: "rated_flow", type: "text", nullable: true })
  ratedFlow!: string | null;

  @Column({ name: "rated_head", type: "text", nullable: true })
  ratedHead!: string | null;

  @Column({ name: "seal_plan", type: "text", nullable: true })
  sealPlan!: string | null;

  @Column({ type: "text", nullable: true })
  driver!: string | null;

  @Column({ name: "measurement_type", type: "text", nullable: true })
  measurementType!: string | null;

  @Column({ type: "text", nullable: true })
  range!: string | null;

  @Column({ type: "text", nullable: true })
  communication!: string | null;

  @Column({ type: "text", nullable: true })
  accuracy!: string | null;

  @Column({ name: "hazardous_area", type: "text", nullable: true })
  hazardousArea!: string | null;

  @Column({ name: "process_connection", type: "text", nullable: true })
  processConnection!: string | null;

  @Column({ type: "text", nullable: true })
  trim!: string | null;

  @Column({ type: "text", nullable: true })
  actuation!: string | null;

  @Column({ type: "text", nullable: true })
  positioner!: string | null;

  @Column({ name: "design_code", type: "text", nullable: true })
  designCode!: string | null;

  @Column({ name: "tema_or_type", type: "text", nullable: true })
  temaOrType!: string | null;

  @Column({ name: "surface_area", type: "text", nullable: true })
  surfaceArea!: string | null;

  @Column({ name: "shell_material", type: "text", nullable: true })
  shellMaterial!: string | null;

  @Column({ name: "tube_or_plate_material", type: "text", nullable: true })
  tubeOrPlateMaterial!: string | null;

  @Column({ name: "design_pressure", type: "text", nullable: true })
  designPressure!: string | null;

  @Column({ name: "design_temperature", type: "text", nullable: true })
  designTemperature!: string | null;

  @Column({ name: "tool_type", type: "text", nullable: true })
  toolType!: string | null;

  @Column({ type: "text", nullable: true })
  voltage!: string | null;

  @Column({ type: "text", nullable: true })
  chuck!: string | null;

  @Column({ name: "max_torque", type: "text", nullable: true })
  maxTorque!: string | null;

  @Column({ type: "text", nullable: true })
  speed!: string | null;

  @Column({ type: "text", nullable: true })
  warranty!: string | null;

  @Column({ type: "text", nullable: true })
  current!: string | null;

  @Column({ name: "head_weight", type: "text", nullable: true })
  headWeight!: string | null;

  @Column({ type: "text", nullable: true })
  handle!: string | null;

  @Column({ name: "overall_length", type: "text", nullable: true })
  overallLength!: string | null;

  @Column({ type: "text", nullable: true })
  tips!: string | null;

  @Column({ type: "text", nullable: true })
  count!: string | null;

  @Column({ type: "text", nullable: true })
  magnetic!: string | null;

  @Column({ type: "text", nullable: true })
  tip!: string | null;

  @Column({ name: "shaft_length", type: "text", nullable: true })
  shaftLength!: string | null;

  @Column({ type: "text", nullable: true })
  length!: string | null;

  @Column({ name: "jaw_capacity", type: "text", nullable: true })
  jawCapacity!: string | null;

  @Column({ type: "text", nullable: true })
  finish!: string | null;

  @Column({ name: "cutting_edge", type: "text", nullable: true })
  cuttingEdge!: string | null;

  @Column({ name: "blade_type", type: "text", nullable: true })
  bladeType!: string | null;

  @Column({ type: "text", nullable: true })
  body!: string | null;

  @Column({ name: "quick_change", type: "text", nullable: true })
  quickChange!: string | null;
}
