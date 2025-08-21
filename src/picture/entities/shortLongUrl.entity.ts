import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Picture } from './picture.entity';

@Entity()
export class ShortLongUrl {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Picture, (picture) => picture.shortLongUrl)
  picture: Picture;

  @Column({
    length: 1000,
  })
  longUrl: string;

  @Column({
    length: 10,
  })
  shortUrl: string;

  @CreateDateColumn()
  createTime: Date;

  @UpdateDateColumn()
  updateTime: Date;
}
