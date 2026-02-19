import { Entity, OneToMany, PrimaryColumn } from "typeorm";
import { Catalog } from "./catalog.entity";

@Entity({ name: "supplier" })
export class Supplier {
  @PrimaryColumn({ type: "varchar", length: 160 })
  name!: string;

  @OneToMany(() => Catalog, (catalog) => catalog.supplier)
  catalogs!: Catalog[];
}
