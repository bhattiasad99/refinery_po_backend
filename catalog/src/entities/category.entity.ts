import { Column, Entity, OneToMany, PrimaryColumn } from "typeorm";
import { Catalog } from "./catalog.entity";

@Entity({ name: "category" })
export class Category {
  @PrimaryColumn({ type: "varchar", length: 120 })
  name!: string;

  @OneToMany(() => Catalog, (catalog) => catalog.category)
  catalogs!: Catalog[];
}
