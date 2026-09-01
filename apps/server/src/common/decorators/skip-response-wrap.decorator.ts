import { SetMetadata } from '@nestjs/common';

export const SKIP_RESPONSE_WRAP = 'skipResponseTransform';

export const SkipResponseWrap = () => SetMetadata(SKIP_RESPONSE_WRAP, true);
