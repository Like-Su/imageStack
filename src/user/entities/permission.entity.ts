import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    length: 20,
    comment: '权限代码',
  })
  code: string;

  @Column({
    length: 20,
    comment: '权限说明',
  })
  description: string;
}
