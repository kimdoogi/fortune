/**
 * 점집 건물 하나가 거리에 넘기는 것 (D-075: 점집마다 건물 모양이 다르다).
 * 정적 조각은 거리 배경과 한 덩어리로 합치고, 움직이는 것만 따로 그린다 (07 §4).
 */
import type * as THREE from "three";
import type { GlowSpot } from "../glow";

/** 현판 색 (바탕 그라데이션, 테두리, 글씨) */
export interface SignStyle {
  bgTop: string;
  bgBottom: string;
  border: string;
  text: string;
}

export interface Building {
  /** 램버트 + 버텍스 컬러로 합칠 정적 조각 */
  parts: THREE.BufferGeometry[];
  /** 스스로 빛나는 조각 (창호지, 초롱, 불꽃) */
  lit: THREE.BufferGeometry[];
  glows: GlowSpot[];
  /** 현판 위치와 색 */
  sign: { x: number; y: number; z: number; w: number; h: number; style?: SignStyle };
  /** 문 탭 판정 상자 */
  door: { x: number; y: number; z: number };
  /** 문 앞 걸을 수 있는 경계 (이보다 +z 쪽만 걸을 수 있음) */
  frontEdge: number;
  /** 길찾기에서 막을 사각형 (x0, z0, x1, z1) */
  blockRects: [number, number, number, number][];
  /** 길찾기에서 막을 원 (x, z, 반지름) */
  blockers: [number, number, number][];
  /** 풀을 심지 않을 사각형 (마당 등) */
  clearRects: [number, number, number, number][];
  /** 바닥에 구울 빛 웅덩이 (문 앞 불빛 등) */
  pools: { x: number; z: number; r: number; k: number; color: string }[];
}
