export interface Test {
    id?: number;
    title: string;
    author?: string;
    version?: string;
    description: string;
    instructions: string;
    state?: State | null;
    tags?: string[];
}

export interface Block {
    id?: number;
    name: string;
    order?: number;
    hasTimeLimit?: boolean;
    timeLimit?: number;
    instructions: string;
    randomizeQuestions?: boolean;
    randomizeAnswers?: boolean;
    numberOfQuestions: number;
    questionsType: string;
    numberOfAnswers: number;
    testId: number;
}

export interface Scale {
    id?: number;
    scaleType?: string;
    pole1: string;
    pole2?: string;
    testId: number;
    blockId: number;
}

export interface State {
    id?: number;
    testId: number;
    state: string;
    currentStep: number;
}

export interface Question {
    id?: number;
    text: string;
    imageUrl?: string;
    isActive: boolean;
    hasImage?: boolean;
    blockId: number;
    realId?: number;
}

export interface Answer {
    id?: number;
    text: string;
    questionId: number;
}

export interface Weight {
    id?: number;
    answerId: number;
    scaleId: number;
    value: number;
}

export interface Norm {
    id?: number;
    scaleId: number;
    mean: number;
    stdDev: number;
    type: string;
}

export interface Interpretation {
    id?: number;
    scaleId: number;
    level: number;
    text: string;
}

export interface Tag {
    id?: number;
    name: string;
}

export interface QuestionWithTags extends Question {
  tagsIds: number[];
}

export interface User {
    id?: number;
    firstName: string;
    lastName: string;
    birthDate: string;
    isActive?: boolean;
    email: string;
    assignedToAdmin: number;
}

export interface InvitationPayload {
  userId: number;
  userEmail: string;
  testId: number;
}

export interface TestSession {
  testId: number;
  userId: number;
  email: string;
  token: string;
}
