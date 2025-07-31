import { User } from 'src/user/entities/user.entity';
import {
  Column,
  Entity,
  ManyToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tags } from './tags.entity';

// 图片实体
@Entity()
export class Picture {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: false,
    comment: '图片名称',
  })
  name: string;

  @Column({
    comment: '图片描述',
  })
  description: string;

  @Column({
    nullable: false,
    comment: '图片路径',
  })
  uri: string;

  @OneToOne(() => User)
  @Column({
    nullable: false,
    comment: '图片隶属者',
  })
  owner: User;

  // 图片标签
  @ManyToMany(() => Tags, (tag) => tag.pictures)
  @Column({
    comment: '图片标签',
  })
  tags: Tags[];
}
