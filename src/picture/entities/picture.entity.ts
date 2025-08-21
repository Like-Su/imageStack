import { User } from 'src/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tags } from './tags.entity';
import { PICTURE_STATUS } from 'src/constants';
import { UniqueShortUrl } from './uniqueShortUrl.entity';
import { ShortLongUrl } from './shortLongUrl.entity';

// 图片实体
@Entity()
export class Picture {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    comment: '图片名称',
  })
  name: string;

  @Column({
    comment: '图片描述',
    nullable: true,
    default: '',
  })
  description: string;

  @Column({
    comment: '图片路径',
  })
  uri: string;

  @Column({
    comment: '图片大小',
    nullable: true,
  })
  size: number;

  @ManyToOne(() => User)
  // @OneToOne(() => User)
  owner: User;

  @JoinTable()
  // 图片标签
  @ManyToMany(() => Tags, (tag) => tag.pictures)
  tags: Tags[];

  @OneToOne(() => ShortLongUrl, (shortLongUrl) => shortLongUrl.picture)
  shortLongUrl: ShortLongUrl;

  // 图片状态
  @Column({
    type: 'enum',
    comment: '图片状态',
    enum: PICTURE_STATUS,
    default: PICTURE_STATUS.NORMAL,
  })
  status: PICTURE_STATUS;

  @CreateDateColumn({
    comment: '图片创建时间',
  })
  createTime: Date;

  @UpdateDateColumn({
    comment: '图片修改时间',
  })
  updateTime: Date;
}
