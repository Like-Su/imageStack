import { SetMetadata } from '@nestjs/common';
import { IS_EXPOSE } from './constants';

const IsExpose = () => SetMetadata(IS_EXPOSE, true);
