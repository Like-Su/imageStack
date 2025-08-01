import { User } from 'src/user/entities/user.entity';
import {
  Column,
  Entity,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Picture } from './picture.entity';

@Entity()
export class Tags {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  name: string;

  // 标签对应图片
  @ManyToMany(() => Picture, (picture) => picture.tags)
  pictures: Picture[];

  // 标签 对应的 用户
  @Column({
    type: 'int',
    nullable: false,
  })
  owner_id: number;
}
