import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class RequestLog {
  @PrimaryGeneratedColumn()
  id: number;

  // User id
  @Column({ nullable: true })
  userId: number;

  // Client ip
  @Column({ length: 50, nullable: true })
  ip: string;

  @Column({ length: 10 })
  method: string;

  @Column({ length: 1000 })
  url: string;

  @Column({ type: 'json', nullable: true })
  params: Record<string, any>;

  @Column({ type: 'int', default: 200 })
  statusCode: number;

  // 请求头
  @Column({ length: 500, nullable: true })
  userAgent: string;

  // 请求耗时（毫秒）
  @Column({ type: 'int', nullable: true })
  duration: number;

  // 错误信息（如果有）
  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createTime: Date;
}
