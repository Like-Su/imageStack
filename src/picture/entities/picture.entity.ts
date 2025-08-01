import { User } from 'src/user/entities/user.entity';
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tags } from './tags.entity';
import { PICTURE_STATUS } from 'src/constants';

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

  @Column({
    nullable: false,
    comment: '图片大小',
  })
  size: number;

  // @OneToOne(() => User)
  @Column({
    nullable: false,
    comment: '图片隶属者',
  })
  owner: number;

  @JoinTable()
  // 图片标签
  @ManyToMany(() => Tags, (tag) => tag.pictures)
  tags: Tags[];

  // 图片位置
  @Column({
    comment: '图片位置',
  })
  location: string;

  // 图片状态
  @Column({
    type: 'enum',
    nullable: false,
    comment: '图片状态',
    enum: PICTURE_STATUS,
  })
  status: PICTURE_STATUS;

  @Column({
    nullable: false,
    comment: '图片创建时间',
  })
  createTime: Date;

  @Column({
    nullable: false,
    comment: '图片修改时间',
  })
  updateTime: Date;
}
