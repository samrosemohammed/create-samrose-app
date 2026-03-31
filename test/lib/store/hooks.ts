import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from ".";

/**
 * Use these typed hooks instead of plain useDispatch / useSelector
 * to get full TypeScript inference from your store.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
