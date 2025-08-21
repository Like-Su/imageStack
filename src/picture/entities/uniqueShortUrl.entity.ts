import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UNIQUE_SHORT_URL_STATUS } from '../../constants';
import { Picture } from './picture.entity';

@Entity()
export class UniqueShortUrl {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    length: 10,
  })
  code: string;

  @Column({
    type: 'enum',
    comment: '状态',
    default: UNIQUE_SHORT_URL_STATUS.UNUSED,
    enum: UNIQUE_SHORT_URL_STATUS,
  })
  status: UNIQUE_SHORT_URL_STATUS;

  @CreateDateColumn()
  createTime: Date;

  @UpdateDateColumn()
  updateTime: Date;
}
