import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { Role } from './role.entity';
import { Exclude } from 'class-transformer';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    length: 50,
    comment: '用户名称',
  })
  nickname: string;

  @Column({
    comment: '邮箱',
    unique: true,
  })
  email: string;

  @Exclude()
  @Column({
    length: 50,
    comment: '密码',
  })
  password: string;

  @Column({
    length: 100,
    comment: '头像',
    nullable: true,
  })
  picture: string;

  @Column({
    comment: '账户状态',
    default: 0,
    type: 'tinyint',
  })
  status: number;

  @CreateDateColumn()
  createTime: Date;

  @UpdateDateColumn()
  updateTime: Date;

  @ManyToMany(() => Role)
  @JoinTable({
    name: 'user_roles',
  })
  roles: Role[];
}
