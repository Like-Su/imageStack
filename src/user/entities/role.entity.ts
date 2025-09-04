import {
  Column,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  JoinTable,
} from 'typeorm';
import { Permission } from './permission.entity';

@Entity()
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    length: 20,
    comment: '角色名',
  })
  name: string;

  @ManyToMany(() => Permission, {
    onDelete: 'CASCADE', // 删除 Permission 时自动删除中间表数据
  })
  @JoinTable({
    name: 'role_permissions',
  })
  permissions: Permission[];
}
